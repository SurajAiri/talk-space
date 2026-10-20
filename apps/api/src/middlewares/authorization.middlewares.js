import jwtService from "../services/jwt.service.js";

function authorizeUser(req, res, next) {
  req.user = null;
  try {
    if (req.headers.authorization) {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) next();
      const decoded = jwtService.verifyJWT(token);
      req.user = decoded;
    }
  } catch (error) {
    req.user = null;
  } finally {
    next();
  }
}

function restrictToUser(role = "user") {
  return (req, res, next) => {
    // console.log("User Authorization Middleware:", req.user);
    if (req.user && req.user.userType === role) {
      return next();
    }
    return res.sendResponse(403, {
      message: "Forbidden: You do not have permission to access this resource.",
    });
  };
}

export { authorizeUser, restrictToUser };
