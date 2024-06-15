import _http from "http";
import _https from "https";
import _url from "url";
import _fs from "fs";
import _express from "express";
import _dotenv from "dotenv";
import _cors from "cors";
import _fileUpload from "express-fileupload";
import _axios from "axios";
import _nodemailer from "nodemailer";
import _jwt from "jsonwebtoken";
import _bcrypt from "bcryptjs"; // + @types
import _cloudinary from "cloudinary";
import { Server, Socket } from 'socket.io'


// Lettura delle password e parametri fondamentali
_dotenv.config({ "path": ".env" });

_cloudinary.v2.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.cloudinary_api_key,
    api_secret: process.env.cloudinary_api_secret
});


// Variabili relative a MongoDB ed Express
import { Double, MongoClient, ObjectId } from "mongodb";
import { param } from "jquery";
const DBNAME = process.env.DBNAME;
const connectionString: string = process.env.connectionStringAtlas;
const app = _express();



const HTTP_PORT: number = parseInt(process.env.HTTP_PORT);
let paginaErrore;
const http_server = _http.createServer(app)
const ENCRYPTION_KEY = process.env.encryptionKey
const io= new Server(http_server, {
    cors: {
      origin: "*",
      credentials:false
    }
  });

// Il secondo parametro facoltativo ipAddress consente di mettere il server in ascolto su una delle interfacce della macchina, se non lo metto viene messo in ascolto su tutte le interfacce (3 --> loopback e 2 di rete)
http_server.listen(HTTP_PORT, () => {
    console.log("Server HTTP in ascolto sulla porta " + HTTP_PORT)
})

function init() {
    _fs.readFile("./static/error.html", function (err, data) {
        if (err) {
            paginaErrore = `<h1>Risorsa non trovata</h1>`;
        }
        else {
            paginaErrore = data.toString();
        }
    });
}



/********************************************************************************************************************************
 * ROUTES MIDDLEWARE
 * ****************************************************************************************************************/

// 1. Request log
app.use("/", (req: any, res: any, next: any) => {
    console.log(`${req.hostname}-----> ${req.method}: ${req.originalUrl}`);
    next();
});

// 2. Gestione delle risorse statiche

app.use("/", _express.static("./static"));

// 3. Lettura dei parametri POST di req["body"] (bodyParser)

app.use("/", _express.json({ "limit": "50mb" }));

app.use("/", _express.urlencoded({ "limit": "50mb", "extended": true }));

// 4. Aggancio dei parametri del FormData e dei parametri scalari passati dentro il FormData

app.use("/", _fileUpload({ "limits": { "fileSize": (10 * 1024 * 1024) } }));

// 5. Log dei parametri GET, POST, PUT, PATCH, DELETE
app.use("/", (req: any, res: any, next: any) => {
    if (Object.keys(req["query"]).length > 0) {
        console.log(`       ${JSON.stringify(req["query"])}`);
    }
    if (Object.keys(req["body"]).length > 0) {
        console.log(`       ${JSON.stringify(req["body"])}`);
    }
    next();
});

// 6. Controllo degli accessi tramite CORS
// Procedura che lascia passare tutto, accetta tutte le richieste

const corsOptions = {
    origin: function (origin, callback) {
        return callback(null, true);
    },
    credentials: true
};
app.use("/", _cors(corsOptions));

/*onst whitelist = [
    "http://my-crud-server.herokuapp.com ", // porta 80 (default)
    "https://my-crud-server.herokuapp.com ", // porta 443 (default)
    "http://localhost:3000",
    "https://localhost:3001",
    "http://localhost:4200", // server angular
    "https://cordovaapp", // porta 443 (default)
];
const corsOptions = {
    origin: function(origin, callback) {
    if (!origin) // browser direct call
    return callback(null, true);
    if (whitelist.indexOf(origin) === -1) {
    var msg = `The CORS policy for this site does not
    allow access from the specified Origin.`
    return callback(new Error(msg), false);
    }
    else
    return callback(null, true);
    },
    credentials: true
   };
app.use("/", _cors(corsOptions));*/

// 7. Configurazione di nodemailer
const auth = {
    "user": process.env.gmailUser,
    "pass": process.env.gmailPassword,
}
const transporter = _nodemailer.createTransport({
    "service": "gmail",
    "auth": auth
});
let message = _fs.readFileSync("./message.html", "utf8")
let messageEmergenza=_fs.readFileSync("./messageEmergenza.html","utf-8")

//8. login

app.post("/api/login", async (req, res, next) => {
    let username = req["body"]["username"]
    let password = req["body"]["password"]
    const client = new MongoClient(connectionString)
    await client.connect()
    const collection = client.db(DBNAME).collection("users")
    let regex = new RegExp("^" + username + "$", "i")
    let request = collection.findOne({ "username": regex })
    request.then((dbUser) => {
        if (!dbUser) {
            res.status(401).send("Username or password not valid")
        }
        else {
            _bcrypt.compare(password, dbUser.password, (err, success) => {
                if (err)
                    res.status(500).send("Bcrypt compare error " + err.message)
                else {
                    if (!success) {
                        res.status(401).send("Username or password not valid")
                    }
                    else {
                        if (req["body"]["isAdminAccess"]) {
                            if (dbUser["administrator"] == true) {
                                let token = creaToken(dbUser);
                                console.log(token)
                                res.setHeader("authorization", token)
                                res.setHeader("access-control-expose-headers", "authorization")
                                res.send({ "ris": "ok" })
                            }
                            else
                                res.status(401).send("User unauthorised")
                        }
                        else {
                            if (dbUser["administrator"] == false) {
                                let token = creaToken(dbUser);
                                //console.log(token)
                                res.setHeader("authorization", token)
                                res.setHeader("access-control-expose-headers", "authorization")
                                res.send({ "ris": "ok" })
                            }
                            else {
                                res.status(401).send("Accesso admin non valido")
                            }
                        }

                    }
                }
            })
        }
    })
    request.catch((err) => {
        res.status(500).send("Query fallita")
    })
    request.finally(() => {
        client.close()
    })
})

function creaToken(data) {
    let currentTime = Math.floor(new Date().getTime() / 1000)
    let payload = {
        "_id": data._id,
        "username": data.username,
        "iat": data.iat || currentTime,
        "exp": currentTime + parseInt(process.env.durata_token)
    }
    let token = _jwt.sign(payload, ENCRYPTION_KEY)
    return token
}

//#region NO TOKEN

app.get("/api/eliminaPesiNegativi",async(req,res,next)=>{
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection("arnie")
    db.updateMany({},{"$set":{"dati.$[item].peso":0}},{arrayFilters:[{"item.peso":{"$lt":0}}]})
    .then((data)=>{
        res.send(data)
    })
    .catch((err)=>{
        res.status(500).send(err)
    })
    .finally(()=>{
        client.close()
    })
})

app.get("/api/cambiaTipoPesi",async(req,res,next)=>{
    let promises=[]
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection("arnie")
    db.find().toArray()
    .then((data)=>{
        for(let j in data)
        {
            for(let i in data[j].dati)
            {
                data[j].dati[i].peso=parseFloat(data[j].dati[i].peso) 
            }
            promises.push(db.updateOne({"_id":data[j]._id},{"$set":{"dati":data[j].dati}}))
            
            
        }
        Promise.all(promises)
        .then(()=>{
            res.send("OK")
        })
        .finally(()=>{
            client.close()
        })
    })
    .catch((err)=>{
        res.status(500).send(err)
        client.close()
    })
})
//aggiunta dati arnia
app.get("/api/addData", async (req, res, next) => {
    let idArnia = new ObjectId(req["query"]["id"] as any)
    let lat=(req["query"]["lat"] as any)/1000000
    let lng=(req["query"]["lng"] as any)/1000000
    let peso:number=(req["query"]["peso"] as any as number) 
    if(peso<0)
        peso=0
    let params = {
        "temperatura": (req["query"]["temperatura"] as any as number),
        "umidita": (req["query"]["umidita"] as any as number),
        "peso": peso,
        "data": new Date(),
        "coordinate": {
            "lat": lat,
            "lng": lng
        }
    }
    let query={"$addToSet": { "dati": params }}
    
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection("arnie")
    db.findOne({"_id":idArnia})
    .then((data)=>{
        //verifica se l'arnia è già in stato di emergenza
        if(req["query"]["emergenza"]== "true" && data.stato!="Emergenza")
        {
            query["$set"]={"stato":"Emergenza"}
            inviaMailEmergenza(idArnia)
        }
        db.updateOne({ "_id": idArnia }, query)
        .then((data) => {
            io.to(req["query"]["id"] as string).emit("newData")//invio avviso nuovi dati ai client connessi
            res.send("Dati aggiunti "+data)
        })
        .catch((err) => {
            res.status(500).send("Errore esecuzione query: " + err)
        })
        .finally(() => {
            client.close()
        })

    })
    .catch((err)=>{
        res.status(500).send("Errore esecuzione query: " + err)
        client.close()
    })
})

async function inviaMailEmergenza(idArnia:ObjectId)
{
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection("arnie")
    db.findOne({"_id":idArnia})
    .then(async (dataArnia)=>{
        let promises=[]
        let i=0
        for(let id of dataArnia.users)
        {
            let db = client.db(DBNAME).collection("users")
            promises.push(db.findOne({"_id":id}))
            promises[i].then((data)=>{
                let Mailmessage = messageEmergenza.replace("__code", dataArnia.nome)
                let mailOptions = {
                    "from": auth.user,
                    "to": data.email,
                    "subject": "Arnia in emergenza",
                    "html": Mailmessage,
                }
                transporter.sendMail(mailOptions, async function (err, info) {})
            })
            i++
        }
        Promise.all(promises).finally(()=>{
            client.close()
        })
    })
    .catch((err)=>{
        client.close()
    })
}


//recupero password 1
app.post("/api/recuperoPassword", async (req, res, next) => {
    let email = req["body"]["email"]
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection("users")
    let request = db.findOne({ "email": email })
    request.then((data) => {
        if (data) {
            let code = generaPassword(4)
            let Mailmessage = message.replace("__code", code)
            let mailOptions = {
                "from": auth.user,
                "to": email,
                "subject": "Codice recupero",
                "html": Mailmessage,
            }
            transporter.sendMail(mailOptions, async function (err, info) {
                if (err) {
                    res.status(500).send("Errore invio mail\n" + err.message);
                }
                else {
                    res.send(code)
                }
            })
        }
        else {
            res.status(401).send("Email non registrata")
        }
    })
    request.catch((err) => {
        res.status(500).send("Errore esecuzione query")
    })
    request.finally(() => {
        client.close()
    })
})
//recuperoPassword 2
app.post("/api/recuperoCambioPassword", async (req, res, next) => {
    let newPassword = req["body"]["newPassword"]
    let email = req["body"]["email"]
    let newPasswordCrypted = criptaPassword(newPassword)
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection("users")
    let request = db.updateOne({ "email": email }, {
        $set: {
            "passwordInChiaro": newPassword,
            "password": newPasswordCrypted,
        }
    })
    request.then((data) => {
        res.send("OK")
    })
    request.catch((err) => {
        res.status(500).send("Errore esecuzione query: " + err)
    })
    request.finally(() => {
        client.close()
    })
})

app.post("/api/newUtente", async (req, res, next) => {
    let params = req["body"]
    //cerco se username o email sono già esistenti
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection("users")
    let request = db.findOne({ $or: [{ "email": params["email"] }, { "username": params["username"] }] })
    request.then((data) => {
        if (!data) {
            _cloudinary.v2.uploader.upload(params["image"], { "folder": "techHive/users" })
                .then(async (response) => {
                    params["image"] = response["secure_url"]
                    params["passwordInChiaro"] = params["password"]
                    params["password"] = criptaPassword(params["password"])
                    params["administrator"] = false
                    params["dob"] = new Date(params["dob"])
                    db.insertOne(params)
                        .then((data) => {
                            res.send("OK")
                        })
                        .catch((err) => {
                            res.status(500).send("Errore esecuzione query: " + err)
                        })
                        .finally(() => {
                            client.close()
                        })
                })
                .catch((err) => {
                    client.close()
                    res.status(500).send("Cloudiary upload error: " + err)
                })
        }
        else {
            res.status(409).send("Username o email già esistenti")
            client.close()
        }
    })
    request.catch((err) => {
        res.status(500).send("Errore esecuzione query: " + err)
        client.close()
    })

})

/* app.get("/api/temp",async(req,res,next)=>{
    const client=new MongoClient(connectionString)
    await client.connect()
    let db=client.db(DBNAME).collection("arnie")
    let params={
        "lat":40.89124761883559,
        "lng":14.26735479989982
    }
    db.updateMany({},{$rename:{"dati.$[].coordinate":"posizione"}})
    .catch((err)=>{
        console.log(err)
        res.status(500).send(err)
    })
    .then((data)=>{
        res.send(data)
    })
    .finally(()=>{
        client.close()
    })
}) */


//#endregion

//9. controllo token
app.use("/api/", (req, res, next) => {
    if (!req["query"]["skipTokenTest"]) {
        if (!req.headers["authorization"]) {
            res.status(403).send("Token mancante")
        }
        else {
            let token = req["headers"]["authorization"]
            _jwt.verify(token, ENCRYPTION_KEY, (err, payload) => {
                if (err) {
                    res.status(403).send("Token corrotto " + err)
                }
                else {
                    let newToken = creaToken(payload)
                    console.log(newToken)
                    res.setHeader("authorization", newToken)
                    res.setHeader("access-control-expose-headers", "authorization")
                    req["payload"] = payload
                    next()
                }
            })
        }
    }
    else
        next()

})

//#region DEDICATE

app.post("/api/ripristinaEmergenza/:id",async(req,res,next)=>{
    let idArnia=new ObjectId(req["params"]["id"])
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection("arnie")
    let request = db.updateOne({"_id":idArnia},{"$set":{"stato":"OK"}})
    request.then((data)=>{
        res.send("OK")
    })
    request.catch((err) => {
        res.status(500).send("Errore esecuzione query: " + err)
    })
    request.finally(() => {
        client.close()
    })

})

app.get("/api/getArniaByDate/:id", async (req, res, next) => {
    let arniaId = new ObjectId(req["params"]["id"])
    let from: any = req["query"]["from"]
    let to = new Date(req["query"]["to"].toString())

    from = new Date(from)


    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection("arnie")
    let request = db.findOne({ "_id": arniaId })
    request.then((data) => {
        let datiCorretti=[]
        for (let [i, dato] of data.dati.entries()) {
            let dataConfronto = new Date(new Date(dato.data).toISOString().split("T")[0])
            if (dataConfronto >= from && dataConfronto <= to) {
                datiCorretti.push(dato)
            }
        }
        data.dati=datiCorretti
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Errore esecuzione query: " + err)
    })
    request.finally(() => {
        client.close()
    })
})

app.patch("/api/associaArnia/:id", async (req, res, next) => {
    let arniaId = new ObjectId(req["params"]["id"])
    let userId = new ObjectId(req["body"]["userId"])
    let nome = req["body"]["nome"]
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection("arnie")

    let request = db.updateOne({ "_id": arniaId }, { "$set": { "nome": nome }, "$addToSet": { "users": userId } })
    request.then((data) => {
        res.send("Arnia associata")
    })
    request.catch((err) => {
        res.status(500).send("Errore esecuzione query: " + err)
    })
    request.finally(() => {
        client.close()
    })
})

//PASSARE ALLA RISORSA ID UTENTE E NEL BODY UN JSON CON CHIAVI "username","cognome","nome","dob","email","pob"
app.post("/api/modificaUtente/:id", async (req, res, next) => {
    let userId = new ObjectId(req["params"]["id"])
    let params = req["body"]
    params["dob"] = new Date(params["dob"])
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection("users")
    let request = db.updateOne({ "_id": userId }, { "$set": params })
    request.then((data) => {
        res.send("Utente aggiornato correttamente")
    })
    request.catch((err) => {
        res.status(500).send("Errore esecuzione query: " + err)
    })
    request.finally(() => {
        client.close()
    })
})

//PASSARE ALLA RISORSA ID UTENTE E NEL BODY PASSARE "newPassword" e "oldPassword"


app.get("/api/getArnieUser/:id", async (req, res, next) => {
    let userId = new ObjectId(req["params"]["id"])
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection("arnie")
    db.find({ "users": { $in: [userId] } }).toArray()
        .then((data) => {
            res.send(data)
        })
        .catch((err) => {
            res.status(500).send("Errore esecuzione query: " + err)
        })
        .finally(() => {
            client.close()
        })
})

app.post("/api/modificaPassword/:id", async (req, res, next) => {
    let idUser = new ObjectId(req["params"]["id"])
    let newPassword = req["body"]["newPassword"]
    let newPasswordCrypted = criptaPassword(newPassword)
    let oldPassword = req["body"]["oldPassword"]


    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection("users")
    let request = db.findOne({ "_id": idUser })
    request.then((data) => {
        _bcrypt.compare(oldPassword, data.password, async (err, success) => {
            if (err)
                res.status(500).send("Bcrypt compare error " + err.message)
            else {
                if (!success) {
                    res.status(401).send("Password errata")
                }
                else {
                    const client = new MongoClient(connectionString)
                    await client.connect()
                    let db = client.db(DBNAME).collection("users")
                    let request = db.updateOne({ "_id": idUser }, {
                        $set: {
                            "passwordInChiaro": newPassword,
                            "password": newPasswordCrypted
                        }
                    })
                    request.then((data) => {
                        res.send("OK")
                    })
                    request.catch((err) => {
                        res.status(500).send("Errore esecuzione query " + err)
                    })
                    request.finally(() => {
                        client.close()
                    })
                }
            }
        })
    })
    request.catch((err) => {
        res.status(500).send("Errore esecuzone query: " + err)
    })
    request.finally(() => {
        client.close()
    })

})

//PASSARE ALLA RISORSA ID UTENTE E NEL BODY PASSARE LA NUOVA IMMAGINE BASE64
app.post("/api/addFotoUser/:id", (req, res, next) => {
    let idUser = req["params"]["id"]
    let newImage = req["body"]["img"]
    _cloudinary.v2.uploader.upload(newImage, { "folder": "techHive/users" })
        .then(async (response) => {
            let _id = new ObjectId(idUser)
            const client = new MongoClient(connectionString)
            await client.connect()
            let db = client.db(DBNAME).collection("users")
            let request = db.updateOne({ "_id": _id }, { "$set": { "image": response["secure_url"] } })
            request.then((data) => {
                res.send(data)
            })
            request.catch((err) => {
                res.status(500).send("Errore esecuzione query: " + err)
            })
            request.finally(() => {
                client.close()
            })
        })
        .catch((err) => {
            res.status(500).send("Cloudinary error: " + err)
        })
})

//PASSARE ALLA RISORSA ID UTENTE E NEL BODY PASSARE IL CAMPO MONGODB image

app.delete("/api/eliminaFotoProfilo/:id", (req, res, next) => {
    let idUser = req["params"]["id"]
    let img: string = req["body"]["img"]
    let imgSplit = img.split('/')
    img = imgSplit[imgSplit.length - 1]
    img = img.split('.')[0]
    _cloudinary.v2.api.delete_resources(['techHive/users/' + img], { type: 'upload', resource_type: 'image' })
        .catch((err) => {
            res.status(500).send("Cloudinary error: " + err)
        })
        .then(async (response) => {
            let _id = new ObjectId(idUser)
            const client = new MongoClient(connectionString)
            await client.connect()
            let db = client.db(DBNAME).collection("users")
            let request = db.updateOne({ "_id": _id }, { "$set": { "image": "" } })
            request.then((data) => {
                res.send(data)
            })
            request.catch((err) => {
                res.status(500).send("Errore esecuzione query: " + err)
            })
            request.finally(() => {
                client.close()
            })
        })
})


//#endregion

//#region CRUD

app.get("/api/getCollections", async (req, res, next) => {
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME)
    let request = db.listCollections().toArray()
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Errore lettura collezioni: " + err)
    })
    request.finally(() => {
        client.close()
    })
})

app.get("/api/:collection", async (req, res, next) => {
    let filters = req["query"]
    //console.log(filters)
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection(req.params.collection)
    let request = db.find(filters).toArray()
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Errore lettura collezioni: " + err)
    })
    request.finally(() => {
        client.close()
    })
})
app.get("/api/:collection/:id", async (req, res, next) => {
    let collection = req["params"].collection
    let id = req["params"]["id"]
    let objId
    if (ObjectId.isValid(id)) {
        objId = new ObjectId(req["params"].id)
    }
    else
        objId = id as unknown as ObjectId
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection(collection)
    let request = db.findOne({ "_id": objId })
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Errore esecuzione query: " + err)
    })
    request.finally(() => {
        client.close()
    })
})
app.post("/api/:collection", async (req, res, next) => {
    let collection = req["params"].collection
    let newRecord = req["body"]
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection(collection)
    let request = db.insertOne(newRecord)
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Errore esecuzione query: " + err)
    })
    request.finally(() => {
        client.close()
    })
})

app.delete("/api/:collection/:id", async (req, res, next) => {
    let collection = req["params"].collection
    let id = req["params"]["id"]
    let objId
    if (ObjectId.isValid(id))
        objId = new ObjectId(req["params"].id)
    else
        objId = id as unknown as ObjectId
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection(collection)
    let request = db.deleteOne({ "_id": objId })
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Errore esecuzione query: " + err)
    })
    request.finally(() => {
        client.close()
    })
})
app.delete("/api/:collection", async (req, res, next) => {
    let selectedCollection = req["params"].collection;
    let filters = req["body"];
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.deleteMany(filters);
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

/*
    * Chiama il metodo PATCH con l'obbligo di specificare dentro il body la ACTION da eseguire
    * 
    * @remarks
    * Utilizzando questo metodo la PATCH risulta più flessibile
    * 
    * @param id - id del record
    * @body i nuovi valori da aggiornare, ad esempio: {"$inc":{"qta":1}}
    * @returns Un JSON di conferma aggiornamento
*/

app.patch("/api/:collection/:id", async (req, res, next) => {
    let collection = req["params"].collection
    let id = req["params"]["id"]
    let objId
    if (ObjectId.isValid(id))
        objId = new ObjectId(req["params"].id)
    else
        objId = id as unknown as ObjectId
    let action = req["body"]
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection(collection)
    let request = db.updateOne({ "_id": objId }, action)
    request.then((data) => {
        res.send(data)
        console.log(data)
    })
    request.catch((err) => {
        res.status(500).send("Errore esecuzione query: " + err)
    })
    request.finally(() => {
        client.close()
    })
})

app.patch("/api/:collection", async (req, res, next) => {
    let selectedCollection = req["params"].collection;
    let filters = req["body"].filters;
    let action = req["body"].action;
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.updateMany(filters, action);
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});
/*
    * Chiama il metodo PUT aggiornato il record invece di sostuirlo 
    * 
    * @remarks
    * Utilizzando questo metodo la PUT esegue direttamente il SET del valore ricevuto:
    * 
    * @param id - id del record
    * @body i nuovi valori da aggiornare
    * @returns Un JSON di conferma aggiornamento
*/
app.put("/api/:collection/:id", async (req, res, next) => {
    let collection = req["params"].collection
    let id = req["params"]["id"]
    let objId
    if (ObjectId.isValid(id))
        objId = new ObjectId(req["params"].id)
    else
        objId = id as unknown as ObjectId
    let newValues = req["body"]
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DBNAME).collection(collection)
    let request = db.updateOne({ "_id": objId }, { "$set": newValues })
    request.then((data) => {
        res.send(data)
    })
    request.catch((err) => {
        res.status(500).send("Errore esecuzione query: " + err)
    })
    request.finally(() => {
        client.close()
    })
})
//#endregion
/***************************************************************************** *************************************************************/
//Default route e gestione degli errori
/************************************************************************************************************************************************ */
app.use("/", (req, res, next) => {
    res.status(404)
    if (req.originalUrl.startsWith("/api/"))
        res.send("API non disponibile")
    else
        res.send(paginaErrore)
})
app.use("/", (err, req, res, next) => {
    console.log("************* SERVER ERROR ***************\n", err.stack)
    res.status(500).send(err.message)
})
function generaPassword(lunghezza): string {
    let password: string = ""
    let caratteri = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    for (let i = 0; i < lunghezza; i++) {
        password += caratteri[generaNumero(0, caratteri.length)]
    }
    return password
}
function generaNumero(a, b) {
    return Math.floor((b - a) * Math.random()) + a
}
function criptaPassword(oldPassword): string {
    let regex = new RegExp("^\\$2[aby]\\$10\\$.{53}$")
    let newPassword
    if (!regex.test(oldPassword)) {
        newPassword = _bcrypt.hashSync(oldPassword, 10)
    }
    return newPassword
}

//#region WEB SOCKET
io.on("connection",(clientSocket)=>{
    console.log(' User ' + clientSocket.id + ' isConnected!');
    clientSocket.on("joinRoom",(data)=>{
        clientSocket.join(data["idArnia"])
        console.log("Client "+clientSocket.id+" join on room "+data["idArnia"])
    })
    clientSocket.on("disconnect",(data)=>{
        console.log("User "+clientSocket.id+" is disconneced!")
    })
})

//#endregion