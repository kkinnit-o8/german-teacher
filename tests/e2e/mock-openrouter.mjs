// Placeholder mock of the OpenRouter API (filled in with the teacher chat).
import http from "node:http";
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: [] }));
  })
  .listen(3799);
