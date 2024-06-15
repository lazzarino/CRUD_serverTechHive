window.onload=function(){
    let _divErrore=$("#divErrore")
    let _btnCloseDivErrore=$("#btnCloseDivErrore")
    let _txtUsername=$("#txtUsername")
    let _txtPassword=$("#txtPassword")
    let _btnLogin=$("#btnLogin")


    $("#showPasswordIcon").on("click",function(){
        if($(this).hasClass("bi-eye-fill"))
        {
            $(this).removeClass("bi-eye-fill")
            $(this).addClass("bi-eye-slash-fill")
            _txtPassword.prop("type","text")
        }
        else
        {
            $(this).removeClass("bi-eye-slash-fill")
            $(this).addClass("bi-eye-fill")
            _txtPassword.prop("type","password")
        }
    })

    _divErrore.hide()
    _btnCloseDivErrore.on("click",function(){
        _divErrore.hide()
    })

    $(document).on("keydown",function(event){
        if(event.key=="Enter")
            login()
    })
    _btnLogin.on("click",login)
    
    function login(){
        let username=_txtUsername.val()
        let password=_txtPassword.val()
        let request=inviaRichiesta("POST","/api/login",{username,password,"isAdminAccess":true})
        request.then((response)=>{
            window.location="index.html"
        })
        request.catch((err)=>{
            if(err.response.status==401)
            {
                _divErrore.children("p").text(err.response.data)
                _divErrore.show()
            }
            else
                errore(err)
        })
    }
}