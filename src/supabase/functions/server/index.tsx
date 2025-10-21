import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Create Supabase client for auth operations
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Health check endpoint
app.get("/make-server-80493cf3/health", (c) => {
  return c.json({ status: "ok" });
});

// User registration endpoint
app.post("/make-server-80493cf3/register", async (c) => {
  try {
    const body = await c.req.json();
    const { firstName, lastName, phone, instrument, skillLevel } = body;
    
    if (!firstName || !lastName || !phone || !instrument || !skillLevel) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Create user with phone as email (temporary solution)
    const email = `${phone}@doosell.app`;
    const password = phone; // Use phone as password temporarily
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { 
        firstName, 
        lastName, 
        phone, 
        instrument, 
        skillLevel,
        registeredAt: new Date().toISOString()
      },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (authError) {
      console.error('Auth error during registration:', authError);
      
      // Check if user already exists
      if (authError.message?.includes('already been registered') || authError.code === 'email_exists') {
        // User exists, try to sign them in instead
        console.log('User already exists, attempting sign in...');
        
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) {
          console.error('Sign in error:', signInError);
          return c.json({ 
            error: `User already exists but login failed: ${signInError.message}`,
            userExists: true 
          }, 409); // 409 Conflict
        }
        
        // Get existing user data
        const userId = signInData.user.id;
        const userData = await kv.get(`user:${userId}`);
        const userStats = await kv.get(`user_stats:${userId}`);
        const practiceLogs = await kv.get(`user_practice_logs:${userId}`) || [];
        
        if (!userData) {
          // User exists in auth but not in our KV store, recreate the data
          const newUserData = {
            id: userId,
            firstName,
            lastName,
            phone,
            instrument,
            skillLevel,
            registeredAt: signInData.user.created_at || new Date().toISOString()
          };
          
          await kv.set(`user:${userId}`, newUserData);
          await kv.set(`user_practice_logs:${userId}`, []);
          await kv.set(`user_stats:${userId}`, {
            totalPoints: 0,
            streak: 0,
            level: 1,
            hasActiveSubscription: false,
            subscriptionExpiryDate: null
          });
          
          return c.json({ 
            user: newUserData, 
            authUser: signInData.user,
            session: signInData.session,
            stats: {
              totalPoints: 0,
              streak: 0,
              level: 1,
              hasActiveSubscription: false,
              subscriptionExpiryDate: null
            },
            practiceLogs: [],
            userExists: true,
            message: "User already existed, signed in successfully" 
          });
        }
        
        return c.json({ 
          user: userData,
          authUser: signInData.user,
          session: signInData.session,
          stats: userStats,
          practiceLogs,
          userExists: true,
          message: "User already existed, signed in successfully" 
        });
      }
      
      return c.json({ error: `Registration failed: ${authError.message}` }, 400);
    }

    // Store user data in KV store
    const userId = authData.user.id;
    const userData = {
      id: userId,
      firstName,
      lastName,
      phone,
      instrument,
      skillLevel,
      registeredAt: new Date().toISOString()
    };

    await kv.set(`user:${userId}`, userData);
    await kv.set(`user_practice_logs:${userId}`, []);
    await kv.set(`user_stats:${userId}`, {
      totalPoints: 0,
      streak: 0,
      level: 1,
      hasActiveSubscription: false,
      subscriptionExpiryDate: null
    });

    return c.json({ 
      user: userData, 
      authUser: authData.user,
      userExists: false,
      message: "User registered successfully" 
    });
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: `Registration failed: ${error.message}` }, 500);
  }
});

// User login endpoint
app.post("/make-server-80493cf3/login", async (c) => {
  try {
    const body = await c.req.json();
    const { phone } = body;
    
    if (!phone) {
      return c.json({ error: "Phone number is required" }, 400);
    }

    const email = `${phone}@doosell.app`;
    const password = phone;
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('Auth error during login:', authError);
      return c.json({ error: `Login failed: ${authError.message}` }, 400);
    }

    // Get user data from KV store
    const userId = authData.user.id;
    const userData = await kv.get(`user:${userId}`);
    const userStats = await kv.get(`user_stats:${userId}`);
    const practiceLogs = await kv.get(`user_practice_logs:${userId}`) || [];

    if (!userData) {
      return c.json({ error: "User data not found" }, 404);
    }

    return c.json({ 
      user: userData,
      stats: userStats,
      practiceLogs,
      authUser: authData.user,
      session: authData.session,
      message: "Login successful" 
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: `Login failed: ${error.message}` }, 500);
  }
});

// Get user data endpoint
app.get("/make-server-80493cf3/user/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    
    const userData = await kv.get(`user:${userId}`);
    const userStats = await kv.get(`user_stats:${userId}`);
    const practiceLogs = await kv.get(`user_practice_logs:${userId}`) || [];

    if (!userData) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ 
      user: userData,
      stats: userStats,
      practiceLogs
    });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ error: `Failed to get user data: ${error.message}` }, 500);
  }
});

// Add practice log endpoint
app.post("/make-server-80493cf3/practice-log", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { date, minutes, notes } = body;
    
    if (!date || !minutes) {
      return c.json({ error: "Date and minutes are required" }, 400);
    }

    // Calculate points (10 points per 15 minutes)
    const points = Math.floor(minutes / 15) * 10;
    
    const newLog = {
      id: Date.now().toString(),
      date,
      minutes: parseInt(minutes),
      notes: notes || '',
      points
    };

    // Get current practice logs
    const currentLogs = await kv.get(`user_practice_logs:${user.id}`) || [];
    currentLogs.push(newLog);
    
    // Update practice logs
    await kv.set(`user_practice_logs:${user.id}`, currentLogs);
    
    // Update user stats
    const currentStats = await kv.get(`user_stats:${user.id}`) || {
      totalPoints: 0,
      streak: 0,
      level: 1,
      hasActiveSubscription: false,
      subscriptionExpiryDate: null
    };
    
    const newTotalPoints = currentStats.totalPoints + points;
    const newLevel = Math.floor(newTotalPoints / 1000) + 1;
    
    // Calculate streak (simplified - just increment if practicing)
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    let newStreak = currentStats.streak;
    const todayLogs = currentLogs.filter(log => log.date === today);
    const yesterdayLogs = currentLogs.filter(log => log.date === yesterday);
    
    if (todayLogs.length === 1) { // First practice today
      if (yesterdayLogs.length > 0) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }
    }
    
    const updatedStats = {
      ...currentStats,
      totalPoints: newTotalPoints,
      level: newLevel,
      streak: newStreak
    };
    
    await kv.set(`user_stats:${user.id}`, updatedStats);

    return c.json({ 
      practiceLog: newLog,
      stats: updatedStats,
      message: "Practice log added successfully" 
    });
  } catch (error) {
    console.error('Add practice log error:', error);
    return c.json({ error: `Failed to add practice log: ${error.message}` }, 500);
  }
});

// Update subscription status endpoint
app.post("/make-server-80493cf3/subscription", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { hasActiveSubscription, subscriptionExpiryDate } = body;
    
    // Get current stats
    const currentStats = await kv.get(`user_stats:${user.id}`) || {
      totalPoints: 0,
      streak: 0,
      level: 1,
      hasActiveSubscription: false,
      subscriptionExpiryDate: null
    };
    
    const updatedStats = {
      ...currentStats,
      hasActiveSubscription: hasActiveSubscription || false,
      subscriptionExpiryDate: subscriptionExpiryDate || null
    };
    
    await kv.set(`user_stats:${user.id}`, updatedStats);

    return c.json({ 
      stats: updatedStats,
      message: "Subscription updated successfully" 
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    return c.json({ error: `Failed to update subscription: ${error.message}` }, 500);
  }
});

Deno.serve(app.fetch);