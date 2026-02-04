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
      { method: "POST", path: "/thoughts", description: "Create a thought (auth required)" },
      { method: "PATCH", path: "/thoughts/:id", description: "Update a thought (auth required, owner only)" },
      { method: "POST", path: "/thoughts/:id/like", description: "Like a thought" },
      { method: "DELETE", path: "/thoughts/:id", description: "Delete a thought (auth required, owner only)" },
      { method: "POST", path: "/users", description: "Register new user" },
      { method: "POST", path: "/sessions", description: "Login (get access token)" }
    ],
    authentication: {
      description: "Some endpoints require authentication",
      howTo: "Include 'Authorization' header with your access token",
      protectedEndpoints: ["POST /thoughts", "PATCH /thoughts/:id", "DELETE /thoughts/:id"]
    }
  });
});

// Get all unique categories from database
app.get("/categories", async (req, res) => {
  try {
    const categories = await Thought.distinct("category");
    res.json(categories.filter(Boolean).sort());
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Could not fetch categories",
      message: error.message
    });
  }
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
      user: req.user._id,
      username: req.user.username
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
    // First find the thought to check ownership
    const thought = await Thought.findById(req.params.id);

    if (!thought) {
      return res.status(404).json({
        success: false,
        error: "Thought not found"
      });
    }

    // Check if user owns this thought
    if (thought.user && thought.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Not authorized - you can only delete your own thoughts"
      });
    }

    // Now delete it
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

// PATCH /thoughts/:id - Update a thought (only owner can update)
app.patch("/thoughts/:id", authenticateUser, async (req, res) => {
  try {
    const { message, category } = req.body;

    // First find the thought to check ownership
    const thought = await Thought.findById(req.params.id);

    if (!thought) {
      return res.status(404).json({
        success: false,
        error: "Thought not found"
      });
    }

    // Check if user owns this thought
    if (thought.user && thought.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Not authorized - you can only edit your own thoughts"
      });
    }

    // Update the thought
    const updatedThought = await Thought.findByIdAndUpdate(
      req.params.id,
      { message, category },
      { new: true, runValidators: true }
    );

    res.json(updatedThought);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: "Could not update thought",
      message: error.message
    });
  }
});

// DELETE /users/me - Delete own account
app.delete("/users/me", authenticateUser, async (req, res) => {
  try {
    // Delete all user's thoughts first
    await Thought.deleteMany({ user: req.user._id });

    // Delete the user
    await User.findByIdAndDelete(req.user._id);

    res.json({
      success: true,
      message: "Account deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Could not delete account",
      message: error.message
    });
  }
});

// DELETE /users/:id - Delete user by ID (for debugging - remove in production!)
app.delete("/users/:id", async (req, res) => {
  try {
    // Delete all user's thoughts first
    await Thought.deleteMany({ user: req.params.id });

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    res.json({
      success: true,
      message: "User and their thoughts deleted",
      deleted: { username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: "Could not delete user",
      message: error.message
    });
  }
});

// GET /users - List all users (for debugging - remove in production!)
app.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, { password: 0, accessToken: 0 }); // Exclude sensitive fields
    res.json(users);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Could not fetch users",
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
