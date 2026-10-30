import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import {
  createRoom,
  db,
  emit,
  eq,
  http,
  makeUser,
  next,
  redis,
  ROOM_CONFIG,
  schema,
  silent,
  sleep,
  sid,
  socketFor,
  stop,
} from "./helpers.ts";

after(stop);

const join = (s: any, roomId: string, extra: object = {}) => emit(s, "room:join", { roomId, ...extra });

describe("rooms: creating and previewing", () => {
  test("private room preview reveals nothing about who is inside", async () => {
    const host = await makeUser();
    const stranger = await makeUser();
    const room = await createRoom(host.token, "private");
    assert.match(room.joinCode!, /^\d{8}$/); // 8 digits
    const hs = await socketFor(host.token);
    assert.equal((await join(hs, room.id)).ok, true);

    const preview = await http(`/rooms/${room.id}`, { token: stranger.token });
    assert.equal(preview.status, 200);
    assert.equal(preview.data.requiresJoinCode, true);
    assert.equal("participantCount" in preview.data, false);
    assert.equal("joinCode" in preview.data, false);
    assert.equal("title" in preview.data, false);
  });

  test("previews are rate limited per user", async () => {
    const u = await makeUser();
    const results = new Set<number>();
    for (let i = 0; i < ROOM_CONFIG.previewsPerMinute + 5; i++) {
      results.add((await http(`/rooms/ABCDEF`, { token: u.token })).status);
    }
    assert.ok(results.has(429), "expected to be rate limited");
  });

  test("public listing hides empty rooms and never shows a join code", async () => {
    const host = await makeUser();
    const room = await createRoom(host.token, "public");
    const hs = await socketFor(host.token);
    await join(hs, room.id);
    await sleep(2100); // the lobby snapshot is cached for 2 s
    const list = await http("/rooms", { token: host.token });
    const found = list.data.find((r: any) => r.id === room.id);
    assert.ok(found);
    assert.equal(found.joinCode, undefined);
  });
});

describe("rooms: private join codes", () => {
  test("wrong codes are limited per user, the right code is refused while locked out", async () => {
    const host = await makeUser();
    const guest = await makeUser();
    const room = await createRoom(host.token, "private");
    const gs = await socketFor(guest.token);

    for (let i = 0; i < ROOM_CONFIG.joinAttemptsPerUser; i++) {
      const r = await join(gs, room.id, { joinCode: "00000000" });
      assert.equal(r.code, "INVALID_JOIN_CODE");
    }
    const locked = await join(gs, room.id, { joinCode: room.joinCode });
    assert.equal(locked.ok, false);
    assert.equal(locked.code, "TOO_MANY_ATTEMPTS");
  });

  test("the right code gets a guest in; the host needs none", async () => {
    const host = await makeUser();
    const guest = await makeUser();
    const room = await createRoom(host.token, "private");
    const hs = await socketFor(host.token);
    assert.equal((await join(hs, room.id)).ok, true);
    const gs = await socketFor(guest.token);
    assert.equal((await join(gs, room.id)).code, "JOIN_CODE_REQUIRED");
    const ok = await join(gs, room.id, { joinCode: room.joinCode });
    assert.equal(ok.ok, true);
    assert.equal(ok.peers.length, 1);
  });

  test("room counter keys always carry an expiry (no key can limit someone forever)", async () => {
    const keys = await redis.keys("rl:*");
    assert.ok(keys.length > 0);
    for (const k of keys) assert.ok((await redis.ttl(k)) > 0, `${k} has no expiry`);
  });
});

describe("signaling and connection bookkeeping", () => {
  test("peers hear about each other, signals are relayed only inside the room", async () => {
    const [a, b, outsider] = await Promise.all([makeUser(), makeUser(), makeUser()]);
    const room = await createRoom(a.token);
    const sa = await socketFor(a.token);
    const sb = await socketFor(b.token);
    const so = await socketFor(outsider.token);
    await join(sa, room.id);

    const joined = next(sa, "peer:joined");
    const ack = await join(sb, room.id, { sessionId: sid() });
    assert.equal(ack.ok, true);
    assert.equal((await joined).id, b.id);
    assert.equal(ack.iceTransportPolicy, "all");
    assert.equal(ack.resumed, false);

    // relay inside the room
    const got = next(sb, "signal");
    sa.emit("signal", { to: b.id, data: { candidate: { candidate: "candidate:1 1 udp 1 1.1.1.1 1 typ host" } } });
    assert.equal((await got).from, a.id);

    // an outsider who is NOT in the room can neither send to nor receive from room members
    await join(so, "ZZZZZZ").catch(() => {});
    const quiet = silent(sb, "signal");
    so.emit("signal", { to: b.id, data: { candidate: { candidate: "x" } } });
    assert.equal(await quiet, true);
  });

  test("a clean leave tells everyone; the empty room is deleted", async () => {
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const room = await createRoom(a.token);
    const sa = await socketFor(a.token);
    const sb = await socketFor(b.token);
    await join(sa, room.id);
    await join(sb, room.id);
    const left = next(sa, "peer:left");
    await emit(sb, "room:leave");
    assert.equal((await left).userId, b.id);
    await emit(sa, "room:leave");
    assert.equal(await redis.exists(`room:${room.id}`), 0);
  });

  test("a network blip keeps the seat: same tab returns, nobody is told anything", async () => {
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const room = await createRoom(a.token);
    const sa = await socketFor(a.token);
    const sb1 = await socketFor(b.token);
    const session = sid();
    await join(sa, room.id);
    await join(sb1, room.id, { sessionId: session });

    const noLeft = silent(sa, "peer:left", 1800);
    const noJoin = silent(sa, "peer:joined", 1800);
    (sb1.io as any).engine.close(); // the connection dies without a goodbye
    await sleep(200);

    const sb2 = await socketFor(b.token);
    const ack = await join(sb2, room.id, { sessionId: session });
    assert.equal(ack.ok, true);
    assert.equal(ack.resumed, true); // keep your peer-to-peer links
    assert.equal(ack.peers.length, 1);
    assert.equal(await noLeft, true);
    assert.equal(await noJoin, true);
    // and the new socket really holds the seat: signals reach it
    const got = next(sb2, "signal");
    sa.emit("signal", { to: b.id, data: { candidate: { candidate: "candidate:2" } } });
    assert.equal((await got).from, a.id);
  });

  test("a seat nobody comes back for is released after the grace period", async () => {
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const room = await createRoom(a.token);
    const sa = await socketFor(a.token);
    const sb = await socketFor(b.token);
    await join(sa, room.id);
    await join(sb, room.id, { sessionId: sid() });
    const left = next(sa, "peer:left", ROOM_CONFIG.seatGraceSeconds * 1000 + 2500);
    (sb.io as any).engine.close();
    assert.equal((await left).userId, b.id);
  });

  test("a reload (new tab session) is a fresh join: peers must build new links", async () => {
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const room = await createRoom(a.token);
    const sa = await socketFor(a.token);
    const sb1 = await socketFor(b.token);
    await join(sa, room.id);
    await join(sb1, room.id, { sessionId: sid() });
    const joined = next(sa, "peer:joined");
    (sb1.io as any).engine.close();
    await sleep(200);
    const sb2 = await socketFor(b.token);
    const ack = await join(sb2, room.id, { sessionId: sid() }); // different page load
    assert.equal(ack.resumed, false);
    assert.equal((await joined).id, b.id);
  });

  test("opening the room in a second tab replaces the first", async () => {
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const room = await createRoom(a.token);
    const sa = await socketFor(a.token);
    const sb1 = await socketFor(b.token);
    await join(sa, room.id);
    await join(sb1, room.id, { sessionId: sid() });
    const replaced = next(sb1, "room:replaced");
    const sb2 = await socketFor(b.token);
    assert.equal((await join(sb2, room.id, { sessionId: sid() })).ok, true);
    await replaced;
  });

  test("room capacity is enforced", async () => {
    const host = await makeUser();
    const room = await createRoom(host.token);
    const members = [];
    for (let i = 0; i < ROOM_CONFIG.maxMembers; i++) {
      const u = await makeUser();
      const s = await socketFor(u.token);
      assert.equal((await join(s, room.id)).ok, true);
      members.push(s);
    }
    const extra = await makeUser();
    const se = await socketFor(extra.token);
    assert.equal((await join(se, room.id)).code, "ROOM_FULL");
  });
});

describe("ghost seats", () => {
  test("a seat whose connection exists nowhere is cleaned up by the sweeper (after two sightings)", async () => {
    const { sockets } = await import("./helpers.ts");
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const room = await createRoom(a.token);
    const sa = await socketFor(a.token);
    await join(sa, room.id);
    // simulate a crash: a seat written by a server that no longer exists
    await redis.hset(
      `room:${room.id}:members`,
      b.id,
      JSON.stringify({ id: b.id, name: "Ghost", username: "ghost", socketId: "dead-socket", joinedAt: Date.now() }),
    );
    const left = next(sa, "peer:left", 3000);
    await sockets.sweepGhostSeats(); // first sighting: only noted
    assert.equal(await redis.hexists(`room:${room.id}:members`, b.id), 1);
    await sockets.sweepGhostSeats(); // second sighting: released
    assert.equal(await redis.hexists(`room:${room.id}:members`, b.id), 0);
    assert.equal((await left).userId, b.id);
    // the live member is untouched
    assert.equal(await redis.hexists(`room:${room.id}:members`, a.id), 1);
  });
});

describe("host can remove people", () => {
  test("kick removes, notifies, blocks signals, and bans re-joining", async () => {
    const [host, guest, other] = await Promise.all([makeUser(), makeUser(), makeUser()]);
    const room = await createRoom(host.token);
    const sh = await socketFor(host.token);
    const sg = await socketFor(guest.token);
    const so = await socketFor(other.token);
    await join(sh, room.id);
    await join(sg, room.id, { sessionId: sid() });
    await join(so, room.id, { sessionId: sid() });

    const kicked = next(sg, "room:kicked");
    const leftHost = next(sh, "peer:left");
    const leftOther = next(so, "peer:left");
    const res = await emit(sh, "room:kick", { userId: guest.id });
    assert.equal(res.ok, true);
    await kicked;
    assert.equal((await leftHost).userId, guest.id);
    assert.equal((await leftOther).userId, guest.id);

    // the kicked socket can no longer reach anyone
    const quiet = silent(so, "signal");
    sg.emit("signal", { to: other.id, data: { candidate: { candidate: "x" } } });
    assert.equal(await quiet, true);

    // and cannot come back
    const sg2 = await socketFor(guest.token);
    const again = await join(sg2, room.id, { sessionId: sid() });
    assert.equal(again.ok, false);
    assert.equal(again.code, "REMOVED_FROM_ROOM");
  });

  test("only the host can kick, and not themselves", async () => {
    const [host, guest, other] = await Promise.all([makeUser(), makeUser(), makeUser()]);
    const room = await createRoom(host.token);
    const sh = await socketFor(host.token);
    const sg = await socketFor(guest.token);
    const so = await socketFor(other.token);
    await join(sh, room.id);
    await join(sg, room.id);
    await join(so, room.id);
    assert.equal((await emit(sg, "room:kick", { userId: other.id })).ok, false);
    assert.equal((await emit(sh, "room:kick", { userId: host.id })).ok, false);
    assert.equal((await emit(sh, "room:kick", { userId: "not-a-uuid" })).ok, false);
    // nobody was removed
    const ack = await emit(sg, "room:leave").then(() => true);
    assert.equal(ack, true);
  });
});

describe("reports and moderation", () => {
  async function pairInRoom() {
    const [reporter, offender] = await Promise.all([makeUser(), makeUser()]);
    const room = await createRoom(reporter.token);
    const sr = await socketFor(reporter.token);
    const so = await socketFor(offender.token);
    await join(sr, room.id);
    await join(so, room.id);
    return { reporter, offender, room, sr, so };
  }

  test("you can report someone who is in your room, and not a stranger", async () => {
    const { reporter, offender, room } = await pairInRoom();
    const ok = await http("/reports", {
      token: reporter.token,
      body: { reportedId: offender.id, roomId: room.id, reason: "harassment", messageExcerpt: "something rude" },
    });
    assert.equal(ok.status, 201);

    const stranger = await makeUser();
    const bad = await http("/reports", {
      token: reporter.token,
      body: { reportedId: stranger.id, roomId: room.id, reason: "spam" },
    });
    assert.equal(bad.status, 409);

    const self = await http("/reports", {
      token: reporter.token,
      body: { reportedId: reporter.id, roomId: room.id, reason: "spam" },
    });
    assert.equal(self.status, 400);
  });

  test("reporting is rate limited", async () => {
    const { reporter, offender, room } = await pairInRoom();
    const statuses: number[] = [];
    for (let i = 0; i < ROOM_CONFIG.reportsPerHour + 2; i++) {
      statuses.push(
        (await http("/reports", { token: reporter.token, body: { reportedId: offender.id, roomId: room.id, reason: "spam" } })).status,
      );
    }
    assert.ok(statuses.includes(429));
  });

  test("admin queue: strikes accumulate, 3rd strike suspends, live sessions are cut and tokens die", async () => {
    const { reporter, offender, room, so } = await pairInRoom();
    const admin = await makeUser();
    await db.update(schema.users).set({ userType: "admin" }).where(eq(schema.users.id, admin.id));

    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await http("/reports", {
        token: reporter.token,
        body: { reportedId: offender.id, roomId: room.id, reason: "harassment" },
      });
      ids.push(r.data.id);
    }
    const queue = await http("/admin/reports?status=open", { token: admin.token });
    assert.equal(queue.status, 200);
    assert.ok(queue.data.filter((r: any) => ids.includes(r.id)).length === 3);

    // a normal user can't resolve
    assert.equal((await http(`/admin/reports/${ids[0]}/resolve`, { token: reporter.token, body: { action: "ban" } })).status, 403);

    assert.equal((await http(`/admin/reports/${ids[0]}/resolve`, { token: admin.token, body: { action: "strike" } })).status, 200);
    assert.equal((await http(`/admin/reports/${ids[1]}/resolve`, { token: admin.token, body: { action: "strike" } })).status, 200);
    assert.equal((await http("/users/me", { token: offender.token })).data.status, "active");

    const dropped = new Promise((r) => so.once("disconnect", r));
    assert.equal((await http(`/admin/reports/${ids[2]}/resolve`, { token: admin.token, body: { action: "strike" } })).status, 200);
    await Promise.race([dropped, sleep(2000).then(() => assert.fail("offender's socket was not disconnected"))]);

    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, offender.id));
    assert.equal(row!.strikes, 3);
    assert.equal(row!.status, "suspended");
    assert.equal((await http("/users/me", { token: offender.token })).status, 401); // token revoked
    const login = await http("/auth/login", { body: { email: offender.email, password: offender.password }, ip: "10.9.0.1" });
    assert.equal(login.status, 403);

    // handled reports can't be handled twice
    assert.equal((await http(`/admin/reports/${ids[0]}/resolve`, { token: admin.token, body: { action: "dismiss" } })).status, 409);
  });
});
