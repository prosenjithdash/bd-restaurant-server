const express = require('express');
const app = express();
require('dotenv').config()
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 8000;



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


    // Get all menu items and show display
      app.get('/menu', async (req, res) => {
          const result = await menuCollection.find().toArray()
          res.send(result)
      })
    
     // Get all specific added food cart items and show display then update count
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = {email: email}
          const result = await cartCollection.find(query).toArray()
          res.send(result)
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
    
    // Delete food cart item and delete database on carts
    app.delete('/carts/:id', async (req, res) => {
          const id = req.params.id;
          const query ={_id: new ObjectId(id)}
          const result = await cartCollection.deleteOne(query)
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