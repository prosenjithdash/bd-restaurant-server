const express = require('express');
const app = express();
require('dotenv').config()
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
var jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 8000;

// STRIPE_SECRET_KEY

// Middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kybpity.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
      // await client.connect();
      

    const menuCollection = client.db('bd-restaurant').collection('menu');
    const userCollection = client.db('bd-restaurant').collection('users');
    const cartCollection = client.db('bd-restaurant').collection('carts');
    const paymentCollection = client.db('bd-restaurant').collection('payments');

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d'
      });
      res.send({ token });
    })

    // Get all menu items and show display
      app.get('/menu', async (req, res) => {
        const result = await menuCollection.find().toArray();
          res.send(result)
      })
    // UpdateMenu food  item and update database on menu item
    app.get('/menu/:id', async (req, res) => {
          const id = req.params.id;
          const query ={_id: new ObjectId(id)}
          const result = await menuCollection.findOne(query)
          res.send(result)
    })
    
     // Get all specific added food cart items and show display then update count
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = {email: email}
          const result = await cartCollection.find(query).toArray()
          res.send(result)
    })



    // middleware (jwt)
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization)
      if (!req.headers.authorization) {
        return res.status(401).send({ massage: 'Unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      
      jwt.verify(token,process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ massage: 'Unauthorized access' });

        }
        req.decoded = decoded;
        next();
      })
      

    }

    // verify admin request person is admin or not 
    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {

      const email = req.decoded.email;
       const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
       if (!isAdmin) {
            return res.status(403).send({ massage: 'forbidden access' });

        }
      next();
    }

    // Admin Part
    // Get all users and show display
    app.get('/users',verifyToken, async (req, res) => {
          const result = await userCollection.find().toArray()
          res.send(result)
    })

    // Get verify admin or users 
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;


      if (email !== req.decoded.email) {
        return res.status(403).send({ massage: ' forbidden access' });

      }


      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    })
    
    
     // Post user and save database on users
    app.post('/users', async (req, res) => {
       const user = req.body;
      // insert email if user does not exists:
      // you can do this many way (1. email uniq 2. upsert 3. simple checking)

      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null })
      }
     
          const result = await userCollection.insertOne(user)
          res.send(result)
    })
    
    
    // Post food cart item and save database on carts
    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
          const result = await cartCollection.insertOne(cartItem)
          res.send(result)
    })

    // Post menu  item and save database on menu
    app.post('/menu', verifyToken,verifyAdmin, async (req, res) => {
      const menuItem = req.body;
          const result = await menuCollection.insertOne(menuItem)
          res.send(result)
    })


    // Payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      const amount = parseInt(price * 100)

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
        
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      });
    });

    // payment api
    app.post('/payment', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment)
      // carefully delete each item from the cart
      console.log('payment info', payment);
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      };

      const deleteResult = await cartCollection.deleteMany(query)
      res.send({paymentResult, deleteResult})
    })

    // get payment history  
    app.get('/payments/:email',verifyToken, async (req, res) => {
      const query = { email: req.params.email } 
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result)
    })

    // stats or analytics
    app.get('/admin-stats', verifyToken,verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: '$price'
            }
            
          }
        }
      ]).toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;


      res.send({
        users,
        menuItems,
        orders,
        revenue
      })
    })


    // Patch user for make admin on database 
    app.patch('/users/admin/:id',verifyToken,verifyAdmin, async (req, res) => {
          const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
          const result = await userCollection.updateOne(filter, updatedDoc)
          res.send(result)
    })
    
    // Delete food cart item and delete database on carts
    app.delete('/carts/:id', async (req, res) => {
          const id = req.params.id;
          const query ={_id: new ObjectId(id)}
          const result = await cartCollection.deleteOne(query)
          res.send(result)
    })

    // Delete user  and delete database on carts
    app.delete('/users/:id', verifyToken,verifyAdmin, async (req, res) => {
          const id = req.params.id;
          const query ={_id: new ObjectId(id)}
          const result = await userCollection.deleteOne(query)
          res.send(result)
    })
    
      // Delete menu item and delete database on menu
    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
          const id = req.params.id;
          const query ={_id: new ObjectId(id)}
          const result = await menuCollection.deleteOne(query)
          res.send(result)
    })


    

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('BD Restaurant Server is running...')
})

app.listen(port, () => {
  console.log(`BD Restaurant Server is running on port ${port}`)
})



/**
 * ----------------------------
 *     NAMING CONVENTION
 * ----------------------------
 * 
 * app.get('/users')
 * app.get('/users/:id')
 * app.post('/users')
 * app.put('/users/:id')
 * app.patch('/users/:id')
 * app.delete('/users/:id')
 */