const express = require("express");
const cors = require("cors");

const { Parser } = require("json2csv");

const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const short = require("short-uuid");
require("dotenv").config();
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const upload = multer({ dest: "uploads/" });
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.get("/", async (req, res) => {
  res.send("inventory portal server is running");
});

const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.cwkrobe.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    const productsCollection = client
      .db("inventory-app")
      .collection("productsCollection");
    const customersCollection = client
      .db("inventory-app")
      .collection("customersCollection");
    const ordersCollection = client
      .db("inventory-app")
      .collection("ordersCollection");

    ordersCollection.createIndex({ orderId: 1 }, (err, result) => {
      if (err) {
        console.error("Failed to create index:", err);
        return;
      }

      console.log("Index created successfully");
      // You can start performing searches on the "orderId" field now
    });

    app.get("/api/get-customers", async (req, res) => {
      try {
        const customers = await customersCollection.find().toArray();

        res.send(customers);
      } catch (error) {
        console.error("Error retrieving customers:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    app.get("/api/get-products", async (req, res) => {
      try {
        const products = await productsCollection.find().toArray();

        res.send(products);
      } catch (error) {
        console.error("Error retrieving products:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    //export data in csv format
    app.get("/api/customer-export", async (req, res) => {
      try {
        const data = await customersCollection.find().toArray();
        const flattenedData = data.map((item) => ({
          _id: item._id,
          customer_name: item.customer_details.name,
          customer_phone: item.customer_details.phone,
          customer_location: item.customer_details.location,
          customer_address: item.customer_details.address,
          purchase_total: item.purchase.total,
          orders_processing: item.orders.processing,
          orders_ready: item.orders.ready,
          orders_completed: item.orders.completed,
          orders_returned: item.orders.returned,
        }));
        const filename = "customer_list.csv";

        const json2csvParser = new Parser();
        const csvData = json2csvParser.parse(flattenedData);

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );

        res.send(csvData);
      } catch (error) {
        console.error("Error exporting data:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/api/product-export", async (req, res) => {
      function formatStockDate(isoTimestamp) {
        const date = new Date(isoTimestamp);
        const formattedDate = date.toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "2-digit",
        });

        return formattedDate;
      }
      try {
        const data = await productsCollection.find().toArray();
        const flattenedData = data.map((item) => ({
          _id: item._id,
          orderId: item.orderId,
          image: item.image,
          name: item.name,
          phone: item.phone,
          address: item.address,
          district: item.district,
          products: item.products,
          quantity: item.quantity,
          courier: item.courier,
          deliveryCharge: item.deliveryCharge,
          timestamp: formatStockDate(item.timestamp),
        }));
        const filename = "customer_list.csv";

        const json2csvParser = new Parser();
        const csvData = json2csvParser.parse(flattenedData);

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );

        res.send(csvData);
      } catch (error) {
        console.error("Error exporting data:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/api/order-export", async (req, res) => {
      function formatStockDate(isoTimestamp) {
        const date = new Date(isoTimestamp);
        const formattedDate = date.toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "2-digit",
        });

        return formattedDate;
      }

      try {
        const data = await ordersCollection.find().toArray();
        const flattenedData = data.map((item) => ({
          _id: item._id,
          orderId: item.orderId,
          image: item.image,
          name: item.name,
          phone: item.phone,
          address: item.address,
          district: item.district,
          products: item.products,
          quantity: item.quantity,
          courier: item.courier,
          deliveryCharge: item.deliveryCharge,
          discount: item.discount,
          total: item.total,
          advance: item.advance,
          cash: item.cash,
          instruction: item.instruction,
          orderStatus: "processing",
          timestamp: formatStockDate(item.timestamp),
        }));
        const filename = "customer_list.csv";

        const json2csvParser = new Parser();
        const csvData = json2csvParser.parse(flattenedData);

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );

        res.send(csvData);
      } catch (error) {
        console.error("Error exporting data:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // Backend API route for customer search
    app.get("/api/search-customer", async (req, res) => {
      try {
        const { name, phonenumber } = req.query;
        let searchQuery;

        if (phonenumber) {
          // Search by phone number
          searchQuery = { "customer_details.phone": phonenumber };
        } else if (name) {
          // Search by name (partial match)
          searchQuery = {
            "customer_details.name": { $regex: name, $options: "i" },
          };
        } else {
          return res
            .status(400)
            .json({ success: false, message: "Invalid search query" });
        }

        const pipeline = [
          {
            $match: searchQuery,
          },
          {
            $limit: 50, // Limit the number of search results
          },
        ];

        const customers = await customersCollection
          .aggregate(pipeline)
          .toArray();

        if (customers.length > 0) {
          res.json({ success: true, customers });
        } else {
          res.json({ success: false, message: "No customers found" });
        }
      } catch (error) {
        console.error("Error searching for customers:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });
    app.get("/api/search-product", async (req, res) => {
      try {
        const { name } = req.query;
        let searchQuery;

        searchQuery = {
          name: { $regex: name, $options: "i" },
        };

        const pipeline = [
          {
            $match: searchQuery,
          },
          {
            $limit: 50, // Limit the number of search results
          },
        ];

        const customers = await productsCollection
          .aggregate(pipeline)
          .toArray();

        if (customers.length > 0) {
          res.json({ success: true, customers });
        } else {
          res.json({ success: false, message: "No customers found" });
        }
      } catch (error) {
        console.error("Error searching for customers:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    //get orders

    app.get("/api/get-orders/:filterBy", async (req, res) => {
      const { filterBy } = req.params;

      console.log(filterBy);
      let searchQuery = {}; // Default search query for all orders

      if (filterBy === "processing") {
        searchQuery = { orderStatus: "processing" };
      } else if (filterBy === "ready") {
        searchQuery = { orderStatus: "ready" };
      } else if (filterBy === "completed") {
        searchQuery = { orderStatus: "completed" };
      } else if (filterBy === "returned") {
        searchQuery = { orderStatus: "returned" };
      } else if (filterBy === "cancelled") {
        searchQuery = { orderStatus: "cancelled" };
      }

      const pipeline = [];

      if (Object.keys(searchQuery).length > 0) {
        pipeline.push({
          $match: searchQuery,
        });
      }

      pipeline.push({
        $limit: 50, // Limit the number of search results
      });

      try {
        const orders = await ordersCollection.aggregate(pipeline).toArray();

        if (orders.length > 0) {
          res.json({ success: true, orders });
        } else {
          res.json({ success: false, message: "No orders found" });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    // All post api

    app.post("/api/add-customer", async (req, res) => {
      try {
        const { image, name, phone, district, address, link } = req.body;

        const customer = {
          customer_details: {
            name,
            image,
            phone,
            location: district,
            address,
            link,
          },
          purchase: {
            total: 0,
            last_purchase: null,
          },
          orders: {
            processing: 0,
            ready: 0,
            completed: 0,
            returned: 0,
          },
          timestamp: new Date().toISOString(),
        };

        const result = await customersCollection.insertOne(customer);

        res.json({
          success: true,
          message: "Customer added successfully",
          result,
        });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    // For add product

    app.post("/api/add-product", async (req, res) => {
      try {
        const {
          image,
          name,
          description,
          brand,
          supplier,
          country,
          store,
          liftPrice,
          salePrice,
          qty,
        } = req.body;

        const stockDate = new Date().toISOString();

        const product = {
          image,
          name,
          description,
          brand,
          supplier,
          country,
          store,
          liftPrice,
          salePrice,
          availableQty: qty,
          qty,
          stockDate,
        };

        const result = await productsCollection.insertOne(product);

        res.json({
          success: true,
          message: "Product added successfully",
          result,
        });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    // order collection
    app.post("/api/post-order", async (req, res) => {
      function generateOrderId() {
        const translator = short();
        return translator.new().slice(0, 10);
      }

      try {
        const {
          image,
          name,
          phone,
          address,
          district,
          products,
          quantity,
          courier,
          deliveryCharge,
          discount,
          total,
          advance,
          cash,
          instruction,
        } = req.body;

        const order = {
          orderId: generateOrderId(),
          image,
          name,
          phone,
          address,
          district,
          products,
          quantity,
          courier,
          deliveryCharge,
          discount,
          total,
          advance,
          cash,
          instruction,
          orderStatus: "processing",
          timestamp: new Date().toISOString(),
        };

        const result = await ordersCollection.insertOne(order);

        res.json({
          success: true,
          message: "Order added successfully",
          result,
        });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    app.post("/api/post-orders", upload.single("file"), async (req, res) => {
      function generateOrderId() {
        const translator = short();
        return translator.new().slice(0, 10);
      }

      try {
        const csvFilePath = req.file.path; // Path to the uploaded CSV file
        const orders = [];

        console.log(csvFilePath);
        const convertCSVtoJSON = async (csvFilePath) => {
          return new Promise((resolve, reject) => {
            fs.createReadStream(csvFilePath)
              .pipe(csv())
              .on("data", (data) => {
                console.log(data);
                const products = JSON.parse(data.products);
                console.log(products);
                const order = {
                  orderId: generateOrderId(),
                  image: data?.image,
                  name: data.name,
                  phone: data.phone,
                  address: data.address,
                  district: data.district,
                  products: products,
                  quantity: data.quantity,
                  courier: data.courier,
                  deliveryCharge: data.deliveryCharge,
                  discount: data.discount,
                  total: data.total,
                  advance: data.advance,
                  cash: data.cash,
                  instruction: data.instruction,
                  orderStatus: data.orderStatus,
                  timestamp: new Date().toISOString(),
                };
                orders.push(order);
              })
              .on("end", () => {
                resolve(orders);
              })
              .on("error", (error) => {
                reject(error);
              });
          });
        };

        console.log(orders);

        // Function to connect to MongoDB and insert the orders
        const insertOrdersToMongoDB = async (orders) => {
          try {
            const result = await ordersCollection.insertMany(orders);
            console.log("Orders inserted:", result.insertedCount);
            // Optionally, you can remove the uploaded CSV file after processing
            fs.unlinkSync(csvFilePath);
          } catch (error) {
            console.error("Error inserting orders:", error);
          }
        };

        // Usage example
        convertCSVtoJSON(csvFilePath)
          .then((orders) => {
            insertOrdersToMongoDB(orders);
          })
          .catch((error) => {
            console.error("Error converting CSV to JSON:", error);
          });

        res.json({
          success: true,
          message: "Order added successfully",
          result: orders,
        });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    //All put api
    app.put("/api/put-edit-customer/:id", async (req, res) => {
      try {
        const customerId = req.params.id;
        const {
          image,
          name,
          phone,
          location,
          address,
          link,
          total,
          order,
          processingCount,
          readyCount,
          completedCount,
          returnedCount,
        } = req.body;

        const result = await customersCollection.updateOne(
          { _id: new ObjectId(customerId) },
          {
            $set: {
              "customer_details.name": name,
              "customer_details.image": image,
              "customer_details.phone": phone,
              "customer_details.location": location,
              "customer_details.address": address,
              "customer_details.link": link,
              "purchase.total": total,
              "purchase.last_purchase": order,
              "orders.processing": processingCount,
              "orders.ready": readyCount,
              "orders.completed": completedCount,
              "orders.returned": returnedCount,
            },
          }
        );

        if (result.matchedCount === 1) {
          res.json({ success: true, message: "Customer updated successfully" });
        } else {
          res
            .status(404)
            .json({ success: false, message: "Customer not found" });
        }
      } catch (error) {
        console.error("Error updating customer:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    app.put("/api/put-edit-product/:id", async (req, res) => {
      try {
        const customerId = req.params.id;
        const {
          image,
          name,
          description,
          brand,
          supplier,
          store,
          liftPrice,
          salePrice,
          availableQty,
          qty,
        } = req.body;

        const result = await productsCollection.updateOne(
          { _id: new ObjectId(customerId) },
          {
            $set: {
              image,
              name,
              description,
              brand,
              supplier,
              store,
              liftPrice,
              salePrice,
              availableQty,
              qty,
            },
          }
        );

        if (result.matchedCount === 1) {
          res.json({ success: true, message: "Customer updated successfully" });
        } else {
          res
            .status(404)
            .json({ success: false, message: "Customer not found" });
        }
      } catch (error) {
        console.error("Error updating customer:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    app.put("/api/put-edit-order/:id", async (req, res) => {
      try {
        const customerId = req.params.id;
        const {
          image,
          name,
          description,
          brand,
          supplier,
          store,
          liftPrice,
          salePrice,
          availableQty,
          qty,
        } = req.body;

        const result = await productsCollection.updateOne(
          { _id: new ObjectId(customerId) },
          {
            $set: {
              image,
              name,
              description,
              brand,
              supplier,
              store,
              liftPrice,
              salePrice,
              availableQty,
              qty,
            },
          }
        );

        if (result.matchedCount === 1) {
          res.json({ success: true, message: "Customer updated successfully" });
        } else {
          res
            .status(404)
            .json({ success: false, message: "Customer not found" });
        }
      } catch (error) {
        console.error("Error updating customer:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    app.put("/api/put-update-order-status/:id", async (req, res) => {
      try {
        const orderId = req.params.id;
        const { orderStatus } = req.body;

        const result = await ordersCollection.updateOne(
          { _id: new ObjectId(orderId) },
          {
            $set: {
              orderStatus,
            },
          }
        );

        if (result.matchedCount === 1) {
          res.json({ success: true, message: "order updated successfully" });
        } else {
          res.status(404).json({ success: false, message: "order not found" });
        }
      } catch (error) {
        console.error("Error updating order:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    //update available Stock for multiple products

    app.put("/api/put-update-available-stock", async (req, res) => {
      try {
        const { allProducts } = req.body;

        console.log(allProducts);

        allProducts.forEach(async (product) => {
          const result = await productsCollection.updateOne(
            { _id: new ObjectId(product._id) },
            {
              $set: {
                availableQty: product.availableQty - product.quantity,
              },
            }
          );
        });

        res.json({ success: true, message: "Stock updated successfully" });
      } catch (error) {
        console.error("Error updating stock:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    //All delete api
    app.delete("/api/delete-customer/:id", async (req, res) => {
      try {
        const customerId = req.params.id;

        const result = await customersCollection.deleteOne({
          _id: new ObjectId(customerId),
        });

        if (result.deletedCount === 1) {
          res.json({ success: true, message: "Customer deleted successfully" });
        } else {
          res
            .status(404)
            .json({ success: false, message: "Customer not found" });
        }
      } catch (error) {
        console.error("Error deleting customer:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });

    app.delete("/api/delete-product/:id", async (req, res) => {
      try {
        const productId = req.params.id;

        const result = await productsCollection.deleteOne({
          _id: new ObjectId(productId),
        });

        if (result.deletedCount === 1) {
          res.json({ success: true, message: "Customer deleted successfully" });
        } else {
          res
            .status(404)
            .json({ success: false, message: "Customer not found" });
        }
      } catch (error) {
        console.error("Error deleting customer:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });
    app.delete("/api/delete-order/:id", async (req, res) => {
      try {
        const productId = req.params.id;

        const result = await ordersCollection.deleteOne({
          _id: new ObjectId(productId),
        });

        if (result.deletedCount === 1) {
          res.json({ success: true, message: "order deleted successfully" });
        } else {
          res.status(404).json({ success: false, message: "order not found" });
        }
      } catch (error) {
        console.error("Error deleting order:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });
  } catch (error) {
    console.log(error);
  }
}

run().catch(console.log);

app.listen(port, () => console.log(`inventory is running on ${port}`));
