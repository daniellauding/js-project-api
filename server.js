import cors from "cors"
import express from "express"
import thoughts from "./data/thoughts.json" with { type: "json" };

// Defines the port the app will run on. Defaults to 8080, but can be overridden
// when starting the server. Example command to overwrite PORT env variable value:
// PORT=9000 npm start
const port = process.env.PORT || 8080
const app = express()

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(express.json())

// Start defining your routes here
app.get('/', (req, res) => {
  res.json({
    message: "Welcome to Happy Thoughts API",
    endpoints: [
      { method: "GET", path: "/", description: "This documentation" },
      { method: "GET", path: "/thoughts", description: "Get all thoughts" },
      { method: "GET", path: "/thoughts/:id", description: "Get one thought by ID" },
    ]
  });
})

app.get("/thoughts", (req, res) =>  {

  let results = [...thoughts];

  const category = req.query.category;

  if (category) {
    results = results.filter(t => t.category.toLowerCase() === category.toLowerCase());
  }

  const sort = req.query.sort;

  if (sort === "hearts") {
    results.sort((a, b) => b.hearts - a.hearts);
  } else if (sort === "date") {
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const paginatedResults = results.slice(startIndex, endIndex);

  res.json({
    total: thoughts.length,
    page: page,
    limit: limit,
    totalPages: Math.ceil(results.length / limit),
    results: paginatedResults,
  });
})

app.get('/thoughts/:id', (req, res) => {
  const id = req.params.id;
  const thought = thoughts.find(t => t.id === Number(id));
  
if (!thought) {
  res.status(404).json({
    success: false,
    error: "Thought not found",
    message: `No thought with id ${id} exists`,
  });
  return;
}

  res.json(thought);
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
