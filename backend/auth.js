const users = [
  { username: "admin", password: "admin123" }
];

function authenticate(username, password) {
  return users.find(u => u.username === username && u.password === password);
}

module.exports = { authenticate };
