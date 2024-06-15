// import
import bcrypt from "bcryptjs" // + @types
import {MongoClient, ObjectId}  from "mongodb";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });


const connectionString:string = process.env.connectionStringLocal;
const DBNAME = process.env.DBNAME;


const client = new MongoClient(connectionString);
let promise=client.connect();
promise.then(()=>{
    let collection = client.db(DBNAME).collection("utenti");
    let rq = collection.find().toArray();
    rq.then((data)=>{
        let promises=[]
        for(let user of data)
        {
            let regex=new RegExp("^\\$2[aby]\\$10\\$.{53}$")
            if(!regex.test(user.password))
            {
            
                let _id=new ObjectId(user._id)
                let newPassword=bcrypt.hashSync(user.password, 10)
                let promise= collection.updateOne({"_id":_id},{"$set":{"password":newPassword}})
                promises.push(promise)
            }
        }
        Promise.all(promises).then((results)=>{
            console.log("Password aggiornate correttamente "+promises.length)
        }).catch((err)=>{
            console.log("Errore aggiornamento password "+err.message)
        }).finally(()=>{
            client.close()
        })
    })
    rq.catch((err)=>{
        console.log("Errore lettura record "+err)
        client.close()
    })
    
})
promise.catch((err)=>{
    console.log("Errore connessione database "+err)
})

