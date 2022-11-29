const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x5xgdfn.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
// client.connect(err => {
//   const collection = client.db("test").collection("devices");
//   // perform actions on the collection object
//   client.close();
// });

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log("authHeader", authHeader);

  if (!authHeader) {
    console.log("auth header not present");
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      console.log("Token verification falied");
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const userCollection = client.db("swapClothes").collection("user");
    const categoriesCollection = client
      .db("swapClothes")
      .collection("categories");
    const productCollection = client.db("swapClothes").collection("products");
    const bookingCollection = client.db("swapClothes").collection("booking");
    const paymentCollection = client.db("swapClothes").collection("payment");

    async function verifyAdmin(req, res, next) {
      const query = { uid: req.decoded.uid };
      const dbUser = await userCollection.findOne(query);
      if (dbUser.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    }

    app.post("/jwt", async (req, res) => {
      console.log(req.body);
      let user = req.body;
      const query = { uid: user.uid };
      const dbUser = await userCollection.findOne(query);
      if (!dbUser) {
        user.verified = false;
        await userCollection.insertOne(user);
      } else {
        user = dbUser;
      }
      role = user.role;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      console.log({ user, token, role });
      res.send({ user, token });
    });

    app.get("/categories", async (req, res) => {
      const query = {};
      const categories = await categoriesCollection.find(query).toArray();
      console.log(categories);
      res.send(categories);
    });

    app.get("/users/admin/:uid", async (req, res) => {
      const admin = req.params.uid;
      const query = { uid: admin };
      const user = await userCollection.findOne(query);
      console.log(user);
      res.send({ isAdmin: user?.role === "admin" });
    });

    app.post("/product", verifyJWT, async (req, res) => {
      const product = req.body;

      const uid = req.decoded.uid;
      let query = { uid };
      const user = await userCollection.findOne(query);

      if (!user) {
        res.send({ status: false, message: "user not found" });
      }

      product.createdBy = user.uid;
      product.createdByName = user.name;
      product.createdByVerified = user.verified;
      product.timestamp = Date.now();
      product.reported = false;
      product.status = "available";
      const result = await productCollection.insertOne(product);
      console.log("result", result);
      res.send(result);
    });

    app.get("/myproducts", verifyJWT, async (req, res) => {
      const query = { createdBy: req.decoded.uid };
      const products = await productCollection.find(query).toArray();
      console.log("result", products);
      res.send(products);
    });

    app.get("/showCategoryProducts/:name", async (req, res) => {
      const categoryName = req.params.name;
      const query = {
        categories: categoryName,
      };
      const products = await productCollection.find(query).toArray();
      res.send(products);
    });

    app.get("/advertisedProducts", async (req, res) => {
      const query = {
        show_in_ad: true,
        status: "available",
      };
      const products = await productCollection.find(query).toArray();
      res.send(products);
    });

    app.delete("/product/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;

      const uid = req.decoded.uid;
      let query = { uid };
      const user = await userCollection.findOne(query);

      query = { _id: ObjectId(id) };
      const product = await productCollection.findOne(query);

      if (!user || !product) {
        res.send({ status: false, message: "product not deleted" });
      }

      if (user.role == "admin" || user.uid === product.createdBy) {
        query = { _id: ObjectId(id) };
        const result = await productCollection.deleteOne(query);
        console.log({ query, result });
        res.send(result);
      } else {
        res.send({ status: false, message: "product not deleted" });
      }
    });

    app.patch("/addToAdvertisement/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;

      let query = { _id: ObjectId(id) };
      const product = await productCollection.findOne(query);

      if (product && req.decoded.uid === product.createdBy) {
        query = { _id: ObjectId(id) };
        const updatedDoc = {
          $set: {
            show_in_ad: true,
          },
        };
        const result = await productCollection.updateOne(query, updatedDoc);
        res.send(result);
      } else {
        res.send({ status: false, message: "product not updated" });
      }
    });

    app.patch("/reportProduct/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          reported: true,
        },
      };
      const result = await productCollection.updateOne(query, updatedDoc);
      console.log(result);
      res.send(result);
    });

    app.get("/getAllBuyers", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { role: "buyer" };
      const buyers = await userCollection.find(query).toArray();
      console.log("result", buyers);
      res.send(buyers);
    });

    app.get("/getAllSellers", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { role: "seller" };
      const sellers = await userCollection.find(query).toArray();
      console.log("result", sellers);
      res.send(sellers);
    });

    app.get(
      "/getReportedProducts",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const query = { reported: true };
        const reportedProducts = await productCollection.find(query).toArray();
        console.log("result", reportedProducts);
        res.send(reportedProducts);
      }
    );

    app.patch(
      "/verifySeller/:uid",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const uid = req.params.uid;

        let query = { uid };
        const seller = await userCollection.findOne(query);

        if (seller && seller.role === "seller") {
          query = { createdBy: uid };
          let updatedDoc = {
            $set: {
              createdByVerified: true,
            },
          };
          await productCollection.updateMany(query, updatedDoc);

          query = { uid };
          updatedDoc = {
            $set: {
              verified: true,
            },
          };
          const result = await userCollection.updateOne(query, updatedDoc);
          console.log(result);
          res.send(result);
        } else {
          res.send({ status: false, message: "User is not a seller" });
        }
      }
    );

    app.delete("/user/:uid", verifyJWT, verifyAdmin, async (req, res) => {
      const uid = req.params.uid;
      const query = { uid };
      const result = await userCollection.deleteOne(query);
      console.log({ query, result });
      res.send(result);
    });

    app.post("/booknow", verifyJWT, async (req, res) => {
      const booking = req.body;

      // changing status of product from 'available' to 'booked'
      const query = { _id: ObjectId(booking.productID) };
      const updatedDoc = {
        $set: {
          status: "booked",
        },
      };
      await productCollection.updateOne(query, updatedDoc);

      // adding booking in collection
      booking.buyerUid = req.decoded.uid;
      booking.timestamp = Date.now();
      booking.paymentStatus = "unpaid";
      booking.paymentTransactionId = "";
      const result = await bookingCollection.insertOne(booking);
      console.log("result", result);
      res.send(result);
    });

    app.get("/myorders", verifyJWT, async (req, res) => {
      const query = { buyerUid: req.decoded.uid };
      const bookings = await bookingCollection.find(query).toArray();
      console.log("result", bookings);
      res.send(bookings);
    });

    app.get("/booking/:id", verifyJWT, async (req, res) => {
      const query = { _id: ObjectId(req.params.id) };
      const bookings = await bookingCollection.findOne(query);
      console.log("result", bookings);
      res.send(bookings);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.productSellingPrice;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "bdt",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);

      const id = payment.bookingId;
      const filter = { _id: ObjectId(id) };
      let updatedDoc = {
        $set: {
          paymentStatus: "paid",
          paymentTransactionId: payment.transactionId,
        },
      };
      const updatedResult = await bookingCollection.updateOne(
        filter,
        updatedDoc
      );

      // changing status of product from 'available' to 'booked'
      const query = { _id: ObjectId(payment.productID) };
      updatedDoc = {
        $set: {
          status: "sold",
        },
      };
      await productCollection.updateOne(query, updatedDoc);
      res.send(result);
    });
  } finally {
  }
}

run().catch((err) => console.error(err));

app.get("/", (req, res) => {
  res.send("review server is running..");
});

app.listen(port, () => {
  console.log(`running on: ${port}`);
});
