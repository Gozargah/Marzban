function changeToEn ()
{
    var status = $( "#user_status_label" ).attr("data-data");
    $( "#user_status_label" ).html( status === "active" ? "Active 😉" : status === "limited" ? "Limited 😓" : status === "expired" ? "Expired 😵" : "Disabled 😑" );

    var data = $( "#data_usage" ).attr( "data-data" );
    $( "#data_usage" ).html( "<strong>Data:</strong> <span style='display: inline-block; direction: ltr;'>" + data + "</span>" );
    
    var dateString = $( "#expire_date" ).attr("data-data");
    $( "#expire_date" ).html( "<strong>Expiration Date:</strong> <span style='display: inline-block; direction: ltr;'>" + dateString + "</span>");
    
    var remaining = $( "#rem_days" ).attr( "data-data" );
    $( "#rem_days" ).html( "<strong>Remaining Days:</strong> " + remaining );
    
    $( "#period_reset" ).html( $( "#period_reset" ).attr( "data-data" ) );

    $( "#tab_header_link" ).html("Links");
    $( "#tab_header_apps" ).html("Apps");
    $( "#tab_header_tutorials" ).html("Tutorials");
    $( "#copy_all_label" ).html("Copy All");
    $( ".coming_soon > span" ).html("Coming soon...");
}

function changeToFa ()
{
    var status = $( "#user_status_label" ).attr("data-data");
    $( "#user_status_label" ).html( status === "active" ? "فعال 😉" : status === "limited" ? "تمام شده 😓" : status === "expired" ? "پایان یافته 😵" : "غیرفعال 😑" );

    var data = $( "#data_usage" ).attr( "data-data" );
    $( "#data_usage" ).html( "<strong>داده:</strong> <span style='display: inline-block; direction: ltr;'>" + data + "</span>" );
    
    var dateString = $( "#expire_date" ).attr( "data-data" );
    var date = dateString.includes("∞") ? "∞" : new Date(dateString).toLocaleString( "fa-IR-u-nu-latn" ).replace( ",", " " );
    $( "#expire_date" ).html( "<strong>تاریخ انقضا:</strong> <span style='display: inline-block; direction: ltr;'>" + date + "</span>");
    
    var remaining = $( "#rem_days" ).attr( "data-data" );
    $( "#rem_days" ).html( "<strong>روزهای باقی مانده:</strong> " + remaining.replace( "days)", "روز)" ) );
    
    var period = $( "#period_reset" ).attr( "data-data" );
    if ( period )
    {
        period = period.split( " " )[ 2 ].replace( ")", "" );
        $( "#period_reset" ).html( "(محاسبه " + (period === "year" ? "سالانه" : period === "month" ? "ماهانه" : period === "week" ? "هفتگی" : period === "day" ? "روزانه" : "") + ")");
    }

    $( "#tab_header_link" ).html("لینک‌ها");
    $( "#tab_header_apps" ).html("نرم‌افزارها");
    $( "#tab_header_tutorials" ).html("آموزش‌ها");
    $( "#copy_all_label" ).html("کپی کردن همه");
    $( ".coming_soon > span" ).html("به زودی...");
}
