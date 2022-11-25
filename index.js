const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000


// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x5xgdfn.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// client.connect(err => {
//   const collection = client.db("test").collection("devices");
//   // perform actions on the collection object
//   client.close();
// });

function verifyJWT(req, res, next){
    const authHeader = req.headers.authorization;

    if(!authHeader){
        return res.status(401).send({message: 'unauthorized access'});
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded){
        if(err){
            return res.status(403).send({message: 'Forbidden access'});
        }
        req.decoded = decoded;
        next();
    })
}

async function run(){
try{
    const userCollection = client.db('swapClothes').collection('user');

    app.post('/jwt', async (req, res) =>{
        const user = req.body;
        const query = { uid: user.uid};
        const dbUser = await userCollection.findOne(query);
        if(!dbUser){
            await userCollection.insertOne(user);
        }
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d'})
        console.log({user, token});
        res.send({token})
    })

    // app.post('/services', verifyJWT, async (req, res) => {
    //     const service = req.body;
    //     const result = await serviceCollection.insertOne(service);
    //     console.log("result", result);
    //     res.send(result);
    // });

}
finally{

}
}

run().catch(err => console.error(err));

app.get('/', (req,res)=>{
    res.send("review server is running..");
})

app.listen(port,()=>{
    console.log(`running on: ${port}`);
})