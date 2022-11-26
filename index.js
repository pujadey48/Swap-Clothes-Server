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
    console.log('authHeader', authHeader);

    if(!authHeader){
        console.log('auth header not present');
        return res.status(401).send({message: 'unauthorized access'});
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded){
        if(err){
            console.log('Token verification falied');
            return res.status(403).send({message: 'Forbidden access'});
        }
        req.decoded = decoded;
        next();
    })
}

async function run(){
try{
    const userCollection = client.db('swapClothes').collection('user');
    const categoriesCollection = client.db('swapClothes').collection('categories');
    const productCollection = client.db('swapClothes').collection('products');

    app.post('/jwt', async (req, res) =>{
        let user = req.body;
        const query = { uid: user.uid};
        const dbUser = await userCollection.findOne(query);
        if(!dbUser){
            await userCollection.insertOne(user);
        } else {
            user = dbUser;
        }
        role = user.role;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d'});
        console.log({user, token, role});
        res.send({role, token})
    })

    app.get('/categories', async (req, res) => {
        const query = {};
        const categories = await categoriesCollection.find(query).toArray();
        console.log(categories);
        res.send(categories);
    })

    app.get('/users/admin/:uid', async (req, res) => {
        const admin = req.params.uid;
        const query = { uid : admin}
        const user = await userCollection.findOne(query);
        console.log(user);
        res.send({ isAdmin: user?.role === 'admin' });
    })

    app.post('/product', verifyJWT, async (req, res) => {
        const product = req.body;
        product.createdBy = req.decoded.uid;
        product.timestamp = Date.now();
        product.reported = false;
        product.status = "available";
        const result = await productCollection.insertOne(product);
        console.log("result", result);
        res.send(result);
    });

    app.get('/myproducts', verifyJWT, async (req, res) => {
        const query = { createdBy : req.decoded.uid}
        const products = await productCollection.find(query).toArray();
        console.log("result", products);
        res.send(products);
    });

    

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