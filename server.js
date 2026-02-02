import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Thought from "./models/Thought.js";

// Defines the port the app will run on. Defaults to 8080, but can be overridden
// when starting the server. Example command to overwrite PORT env variable value:
// PORT=9000 npm start
dotenv.config();

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
      { method: "POST", path: "/thoughts", description: "Create a thought" },
      { method: "POST", path: "/thoughts/:id/like", description: "Like a thought" },
      { method: "DELETE", path: "/thoughts/:id", description: "Delete a thought" }
    ]
  });
});

app.get("/thoughts", async (req, res) =>  {
  try {
    const { category, sort, page = 1, limit = 20 } = req.query;

    let filter = {};

    if (category) {
      filter.category = category.toLowerCase();
    }
    
    let query = Thought.find(filter);

    if (sort === "hearts") {
      query = query.sort({ heats: -1 });
    } else if (sort === "date") {
      query = query.sort({ createdAt: -1 });
    } else {
      query = query.sort({ createdAt: -1 });
    }

    const skip = (Number(page) -1) * Number(limit);
    query = query.skip(skip).limit(Number(limit));

    const thoughts = await query;

    const total = await Thought.countDocuments();

    res.json({
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      results: thoughts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Could not fetch thoughts",
      message: error.message
    });
  }
});

app.get('/thoughts/:id', async (req, res) => {
  try {
    const id = req.params.id;
      const thought = await Thought.findById(req.params.id);
      
    if (!thought) {
      return res.status(404).json({
        success: false,
        error: "Thought not found",
        message: `No thought with id ${id} exists`,
      });
    }

    res.json(thought);
  } catch(error) {
    res.status(400).json({
      success: false,
      error: "Invalid id format",
      message: error.message
    });
  }
});

app.post("/thoughts", async(req, res) => {
  try {
    const { message, category } = req.body;

    const thought = new Thought({
      message,
      category
    });

    const savedThought = await thought.save();

    res.status(201).json(savedThought);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: "Could not create thought",
      message: error.message
    });
  }
});

app.post("/thoughts/:id/like", async (req, res) => {
  try {
    const thought = await Thought.findByIdAndUpdate(
      req.params.id,
      { $inc: { hearts: 1 } },
      { new: true }
    );

    if (!thought) {
      return res.status(404).json({
        success: false,
        error: "Thought not found",
      });
    }
    
    res.json(thought)

  } catch (error) {
    res.status(400).json({
      success: false,
      error: "Could not like thought",
      message: error.message
    });
  }
});

app.delete("/thoughts/:id", async (req, res) => {
  try {
    const thought = await Thought.findByIdAndDelete(req.params.id);

    if (!thought) {
      return res.status(404).json({
        success: false,
        error: "Thought not found"
      });
    }

    res.json({
      success: true,
      message: "Thought deleted",
      deleted: thought
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: "Could not delete thought",
      message: error.message
    });
  }
});

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Connected to MongoDB");

    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`)
    });

  })
  .catch((error) => {
    console.error("Could not connect to MongoDB:", error.message)
  });
