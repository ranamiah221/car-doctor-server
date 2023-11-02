const express = require('express');
const cors = require('cors');
const jwt= require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;


// middleware 

app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pywpewq.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
// middleware...

const logger = async(req, res, next) =>{
  console.log('called :', req.host , req.originalUrl);
  next();
} 

const verifyToken = async(req, res, next)=>{
  const token = req.cookies?.token;
  if(!token){
    return res.status(401).send({message : 'unauthorized access'})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded)=>{
    if(err){
      console.log(err)
      return res.status(401).send({message : 'unauthorized access'})
    }
    req.user = decoded;
    next();
  })
  
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // auth related api...
   app.post('/jwt',logger, async(req, res)=>{
    const user = req.body;
   
    const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '2h'})
    res
    .cookie('token', token, {
      httpOnly : true, 
      secure: false,
    })
    .send({success: true});
   })

    // service related api..
    const serviceCollection = client.db('carDoctor').collection('services');
    const bookingCollection = client.db('carDoctor').collection('bookings');
    app.get('/services', logger, async(req, res)=>{
        const cursor = serviceCollection.find();
        const result= await cursor.toArray();
        res.send(result);
    })

    app.get('/services/:id',logger, async(req, res)=>{
        const id = req.params.id;
        const query = {_id : new ObjectId(id)}
        const options = {
          projection: { title: 1, price: 1,service_id: 1, img:1},
        };
        const result = await serviceCollection.findOne(query, options);
        res.send(result);
    })
    
    // bookings...
    app.get('/bookings', logger, verifyToken, async(req, res)=>{
      console.log(req.query.email);
      if(req.query.email !== req.user.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      let query= {};
      // console.log('tok tok token', req.cookies.token);
      if(req.query?.email){
        query = {
          email : req.query.email,
        }
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/bookings', logger, async(req, res)=>{
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    })
    app.patch('/bookings/:id', async(req, res)=>{
      const id = req.params.id;
      const filter ={_id : new ObjectId(id)}
      const updatedBooking = req.body;
      const updateDoc = {
      $set: {
        status: updatedBooking.status
      },
    };
    const result = await bookingCollection.updateOne(filter, updateDoc)
    res.send(result);

    })
    app.delete('/bookings/:id', async(req, res)=>{
      const id = req.params.id;
      const query ={_id: new ObjectId(id)}
      const result = await bookingCollection.deleteOne(query)
      res.send(result);
    })

    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/',(req, res)=>{
    res.send('Car doctor server');
})
app.listen(port,(req,res)=>{
   console.log('car doctor server running port :',port);
})