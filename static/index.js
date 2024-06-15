"use strict"
$(document).ready(function() {
    let divIntestazione = $("#divIntestazione");
    let divFilters = $(".card").eq(0);
    let divCollections = $("#divCollections");
    let table = $("#mainTable");
    let divDettagli = $("#divDettagli");
    let currentCollection = "";

    divFilters.hide();
    $("#btnAdd").prop("disabled", true);
    $("#lstHair").prop("selectedIndex", -1);

    getCollections();

    $("#btnFind").on("click", () => {
        let hair = $("#lstHair").val();
        let gender = "";
        if (divFilters.find("input:checkbox:checked").length == 1) {
            gender = divFilters.find("input:checkbox:checked").val();
        }
        let filters = {};
        if (hair) {
            filters["hair"] = hair.toLowerCase();
        }
        if (gender) {
            filters["gender"] = gender.toLowerCase();
        }
        getDataCollection(filters);
    });

    $("#btnAdd").on("click", () => {
        divDettagli.empty();
        $("<textarea>").appendTo(divDettagli).prop("placeholder", '{"nome": "Pippo"}');
        $("<button>").addClass("btn btn-success btn-sm").appendTo(divDettagli).text("INVIA").on("click", function () {
            let newRecord = divDettagli.children("textarea").val();
            try {
                newRecord = JSON.parse(newRecord);
            } catch (error) {
                alert(`JSON non valido:\n${error}`);
                return;
            }
            let rq = inviaRichiesta("POST", `/api/${currentCollection}`, newRecord);
            rq.then((response) => {
                console.log(response.data);
                alert("Record inserito correttamente");
                getDataCollection();
            });
            rq.catch(errore);
        });
        $("<button>").appendTo(divDettagli).text("ANNULLA").addClass("btn btn-sm btn-danger").on("click",()=>{
            divDettagli.empty()})
    });
   
    /******************************************************/

    function getCollections() {
        let rq = inviaRichiesta("GET", "/api/getCollections");
        rq.then((response) => {
            console.log(response.data);
            let label = divCollections.children("label");
            response.data.forEach((item, i) => {
                let clonedLabel = label.clone().appendTo(divCollections);
                clonedLabel.children("span").text(item.name);
                clonedLabel.children("input:radio").on("click", function () {
                    currentCollection = $(this).next("span").text();
                    $("#btnAdd").prop("disabled", false);
                    getDataCollection();
                });
            });
            label.remove();
        });
        rq.catch(errore);
    }

    function getDataCollection(filters = {}) {
        let rq = inviaRichiesta("GET", `/api/${currentCollection}`, filters);
        rq.then((response) => {
            console.log(response.data);
            divIntestazione.find("strong").eq(0).text(currentCollection);
            divIntestazione.find("strong").eq(1).text(response.data.length);
            let _tbody = table.children("tbody");
            _tbody.empty();
            response.data.forEach((item, i) => {
                let tr = $("<tr>").appendTo(_tbody);
                $("<td>").appendTo(tr).text(item._id).on("click", function () {
                    getDetails(item._id);
                });
                // Facendo così si prende la seconda chiave qualunque essa sia
                let key = Object.keys(item)[1];
                $("<td>").appendTo(tr).text(item[key]).on("click", function () {
                    getDetails(item._id);
                });
                let td = $("<td>").appendTo(tr);
                $("<div>").appendTo(td).on("click", () => {
                    getDetails(item._id, "patch");
                });
                $("<div>").appendTo(td).on("click", () => {
                    getDetails(item._id, "put");
                });
                $("<div>").appendTo(td).on("click", () => {
                    deleteRecord(item._id);
                });
            });
            if (currentCollection == "unicorns") {
                divFilters.show();
            }
            else {
                divFilters.hide();
                divFilters.find("input:checkbox").prop("checked", false);
                $("#lstHair").prop("selectedIndex", -1);
            }
            divDettagli.empty();
        });
        rq.catch(errore);
    }

    function getDetails(_id, method = "get") {
        let rq = inviaRichiesta("GET", `/api/${currentCollection}/${_id}`);
        rq.then((response) => {
            console.log(response.data);
            divDettagli.empty();
            $("<strong>").appendTo(divDettagli).text("DETTAGLI:");
            $("<br>").appendTo(divDettagli);
            $("<br>").appendTo(divDettagli);
            if (method == "get") {
                for (let key in response.data) {
                    $("<strong>").appendTo(divDettagli).text(`${key}: `);
                    $("<span>").appendTo(divDettagli).text(JSON.stringify(response.data[key]));
                    $("<br>").appendTo(divDettagli);
                }
            }
            else {
                // Permette di eliminare la chiave _id perchè non dobbiamo modificarla
                delete (response.data["_id"]);
                let textarea = $("<textarea>").appendTo(divDettagli)
                if(method.toLowerCase()=="patch")
                {
                    textarea.val(JSON.stringify({"$set":{"residenza":"fossano"}},null,3))
                }
                else{
                    textarea.val(JSON.stringify(response.data, null, 3));
                }
                
                textarea.css("height", `${textarea.get(0).scrollHeight}px`);
                $("<button>").appendTo(divDettagli).text("AGGIORNA").addClass("btn btn-sm btn-success").on("click", function () {
                    let updatedRecord = divDettagli.children("textarea").val();
                    try {
                        updatedRecord = JSON.parse(updatedRecord);
                    } catch (error) {
                        alert(`JSON non valido:\n${error}`);
                        return;
                    }
                    let rq = inviaRichiesta(method.toUpperCase(), `/api/${currentCollection}/${_id}`, updatedRecord);
                    rq.then((response) => {
                        console.log(response.data);
                        alert("Aggiornamento avvenuto correttamente");
                        getDataCollection();
                    })
                    rq.catch(errore);
                });
            }
            $("<button>").appendTo(divDettagli).text("ANNULLA").addClass("btn btn-sm btn-danger").on("click",()=>{
                divDettagli.empty()
            })
        });
       
        rq.catch(errore);
    }

    function deleteRecord(_id) {
        if (confirm("Vuoi veramente cancellare questo record?")) {
            let rq = inviaRichiesta("DELETE", `/api/${currentCollection}/${_id}`);
            rq.then((response) => {
                console.log(response.data);
                alert("Record cancellato correttamente");
                getDataCollection();
            });
            rq.catch(errore);
        }
    }

    $("#test").hide();

    $("#test").on("click", () => {
        let filters = { "hair": "blonde", "gender": "f" };
        let action = { "$inc": { "vampires": 10 } };
        let rq = inviaRichiesta("PATCH", "/api/unicorns", { filters, action });
        rq.then((response) => {
            console.log(response.data);
            alert("Aggiornamento avvenuto correttamente");
            getDataCollection();
        });
        rq.catch(errore);
    });
    
    $("#test").on("click", () => {
        let filters = { "hair": "blonde", "gender": "m" };
        let rq = inviaRichiesta("DELETE", "/api/unicorns", filters);
        rq.then((response) => {
            console.log(response.data);
            alert("Cancellazione avvenuta correttamente");
            getDataCollection();
        });
        rq.catch(errore);
    });

    $("#btnProvaFunzione").on("click",()=>{
        let rq=inviaRichiesta("POST","/api/modificaUtente/"+"65e49fbed34c765b5c9f5cf2",{"username":"sasso","cognome":"Rosso","nome":"Mario","dob":new Date(),"email":"p.sasso@negro","pob":"scampia"})
        rq.then((data)=>{
            console.log(data)
            alert("Successo")
        })
        rq.catch((err)=>{
            console.log(err)
            alert("Errore: "+err)
        })
    })
	
});
