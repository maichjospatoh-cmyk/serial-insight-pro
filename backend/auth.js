const users = [
  { username: "admin", password: "admin123", role: "admin" },
  { username: "viewer", password: "viewer123", role: "viewer" }
];

function authenticate(username, password) {
  return users.find(
    u => u.username === username && u.password === password
  );
}

module.exports = { authenticate };
