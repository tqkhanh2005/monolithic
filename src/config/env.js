require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: Number(process.env.JWT_EXPIRES_IN || 3600),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 10),
};
