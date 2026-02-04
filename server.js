import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import Thought from "./models/Thought.js";
import User from "./models/User.js";

dotenv.config();

const port = process.env.PORT || 8080
const app = express()

app.use(cors())
app.use(express.json())

const authenticateUser = async (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Access denied. No token provided"
    });
  }

  try {
    const user = await User.findOne({ accessToken: token });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid token"
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Authentication error"
    });
  }
};

app.get('/', (req, res) => {
  res.json({
    message: "Welcome to Happy Thoughts API",
    endpoints: [
      { method: "GET", path: "/", description: "This documentation" },
      { method: "GET", path: "/thoughts", description: "Get all thoughts" },
      { method: "GET", path: "/thoughts/:id", description: "Get one thought by ID" },
      { method: "POST", path: "/thoughts", description: "Create a thought" },
      { method: "POST", path: "/thoughts/:id/like", description: "Like a thought" },
      { method: "DELETE", path: "/thoughts/:id", description: "Delete a thought" },
      { method: "POST", path: "/users", description: "Register new user" },
      { method: "POST", path: "/sessions", description: "Login (get access token)" }
    ],
    authentication: {
      description: "Some endpoints require authentication",
      howTo: "Include 'Authorization' header with your access token",
      protectedEndpoints: ["POST /thoughts", "DELETE /thoughts/:id"]
    }
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

app.post("/thoughts", authenticateUser, async(req, res) => {
  try {
    const { message, category } = req.body;

    const thought = new Thought({
      message,
      category,
      user: req.user._ud
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

app.delete("/thoughts/:id", authenticateUser, async (req, res) => {
  try {
    const thought = await Thought.findByIdAndDelete(req.params.id);

    if (!thought) {
      return res.status(404).json({
        success: false,
        error: "Thought not found"
      });
    }

    if (thought.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await Thought.findByIdAndDelete(req.params.id);

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

app.post("/users", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Email already exists"
      });
    }

    const user = new User({ username, email, password });
    const savedUser = await user.save();

    res.status(201).json({
      success: true,
      userId: savedUser._id,
      username: savedUser.username,
      accessToken: savedUser.accessToken
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: "Could not create user",
      message: error.message
    })
  }
});

app.post("/sessions", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password"
      })
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch) {
      return res.status(401).json({
        success:false,
        error: "Invalid email or password"
      });
    }
    user.accessToken = crypto.randomUUID();
    await user.save();

    res.json({
      success: true,
      userId: user._id,
      username: user.username,
      accessToken: user.accessToken
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Login failed",
      message: error.message
    })
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
