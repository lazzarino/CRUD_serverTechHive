import {MongoClient, ObjectId}  from "mongodb";
// import moment from "moment"

// config
const connectionString:string = "mongodb+srv://Corneanu:FYN7ESXgpibPsJb8@cluster5b.ogdili3.mongodb.net/?retryWrites=true&w=majority"
const DB_NAME = "techHive";
const COLLECTION = "arnie"

const idArnie=["6634be2c219c3419879f5019","666daaf144b54a59fe709f76","666dac1844b54a59fe709f79","666dac4844b54a59fe709f7a","666dac8844b54a59fe709f7b","666dacb844b54a59fe709f7c","666dad3f44b54a59fe709f7d","666dad7b44b54a59fe709f7e","666dadde44b54a59fe709f7f"] //ID arnie disponibili, se si aggiunge un arnia, aggiungere il suo objectID in questo vettore
const latVet=[41.90230339459851,6.225890643703945,10.945841618198761,45.48489775330036]
const lngVet=[12.457240247431642,-75.60436483084558,-74.79531419848534,9.202710538961542]

setInterval(creaDati,10000)

async function creaDati()
{
    let idArnia=new ObjectId(idArnie[generaNumero(0,idArnie.length-1)])
    let params={
        "temperatura":generaNumeroDecimale(19,30),
        "umidita":generaNumeroDecimale(60,95),
        "peso":generaNumeroDecimale(10,20),
        "data":new Date(),
        "coordinate":{
            "lat":latVet[generaNumero(0,latVet.length-1)],
            "lng":lngVet[generaNumero(0,lngVet.length-1)]
        },
        "emergenza":false
    }
    const client = new MongoClient(connectionString)
    await client.connect()
    let db = client.db(DB_NAME).collection(COLLECTION)
    db.updateOne({"_id":idArnia},{"$addToSet":{"dati":params}})
    .then((data)=>{
        console.log(data)
    })
    .catch((err)=>{
        console.log(err)
    })
    .finally(()=>{
        client.close()
    })
}


// La generazione avviene ESTREMO SUPERIORE INCLUSO perchè in questo modo 
// le chiamate risultano più leggibili
function generaNumero(a=1, b=16){
	let n = Math.floor((b-a+1)*Math.random()) + a
	return n
}

function generaNumeroDecimale(a:number, b:number){
	a=a*100
	b=b*100;
	let n = Math.floor((b-a+1)*Math.random()) + a
	return n/100
}