import type { Request, Response } from "express";
import { publicProfileOptions } from "../../config/profile.config.js";
import { AppError } from "../../utils/errors.js";
import { onboardingSchema, privacyPolicySchema, updateProfileSchema } from "./schemas.js";
import * as userService from "./services.js";

function parse<S extends { safeParse: (d: unknown) => any }>(
  schema: S,
  data: unknown,
): ReturnType<S["safeParse"]> extends { data?: infer D } ? NonNullable<D> : never {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, result.error.issues[0]?.message ?? "Invalid input");
  }
  return result.data;
}

export function getOptions(_req: Request, res: Response) {
  res.sendResponse(200, publicProfileOptions());
}

export async function getMe(req: Request, res: Response) {
  const user = await userService.findUserById(req.auth!.id);
  if (!user) throw new AppError(404, "User not found");
  res.sendResponse(200, user);
}

export async function updateMe(req: Request, res: Response) {
  const patch = parse(updateProfileSchema, req.body);
  if (Object.keys(patch).length === 0) throw new AppError(400, "Nothing to update");
  res.sendResponse(200, await userService.updateProfile(req.auth!.id, patch), "Profile updated");
}

export async function completeOnboarding(req: Request, res: Response) {
  const input = parse(onboardingSchema, req.body);
  res.sendResponse(200, await userService.completeOnboarding(req.auth!.id, input), "Welcome aboard");
}

export async function acceptPrivacyPolicy(req: Request, res: Response) {
  parse(privacyPolicySchema, req.body);
  res.sendResponse(200, await userService.acceptPrivacyPolicy(req.auth!.id), "Privacy Policy accepted");
}
