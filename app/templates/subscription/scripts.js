const subLink = window.location.href;
$( ".sub-link" ).attr( "data-link", subLink );
$( ".sub-button" ).attr( "data-link", subLink );
let qrSize = $( window ).width() > 500 ? 400 : $( window ).width() - 100;

$( window ).resize( function ()
{
    if ( $( window ).width() > 500 ) qrSize = 400;
    else qrSize = $( window ).width() - 100;
} );

function updateChart ( totalLimit, usedLimit )
{
    const chart = $( '.usage-chart' ).first();
    let totalPercentage = ( parseFloat( usedLimit ) / parseFloat( totalLimit ) ) * 100;
    if ( totalLimit == "∞" ) totalPercentage = 0;

    chart.attr( "data-percent", totalPercentage.toFixed( 2 ) );
    chart.html( "<span>" + totalPercentage.toFixed( 2 ) + "%</span>" );
    chart.easyPieChart( {} );
}

function changeTab ( index )
{
    const headers = $( ".headers > .header" );
    const tabs = $( ".tabs-container > .tab" );
    headers.removeClass( "active" );
    tabs.removeClass( "active" );
    headers.eq( index ).addClass( "active" );
    tabs.eq( index ).addClass( "active" );
}

function copyLink ( link, button )
{
    if ( navigator.clipboard )
    {
        if ( link == "sub" ) link = subLink;
        navigator.clipboard.writeText( link )
            .catch( function ( error )
            {
                console.error( 'Error copying text to clipboard:', error );
            } );
    } else
    {
        const tempInput = $( '<input>' ).attr( "type", "hidden" ).val( link ).appendTo( $( document.body ) );
        tempInput.select();
        document.execCommand( 'copy' );
        tempInput.remove();
    }

    $( button ).css( "background", "#0b8a0f" );
    setTimeout( function ()
    {
        $( button ).css( "background", "unset" );
    }, 1500 );
}

function copyAllLinks ( )
{
    let link = [];
    $( ".link-remark:not(.sub-link)" ).each( ( i, ele ) =>
    {
        link.push($( ele ).attr( "data-link" ));
    } );
    if ( navigator.clipboard )
    {
        navigator.clipboard.writeText( link.join("\n") )
            .catch( function ( error )
            {
                console.error( 'Error copying text to clipboard:', error );
            } );
    } else
    {
        const tempInput = $( '<input>' ).attr( "type", "hidden" ).val( link.join("\n") ).appendTo( $( document.body ) );
        tempInput.select();
        document.execCommand( 'copy' );
        tempInput.remove();
    }
    alert( "All links copied!" );
}

const popup = $( "#popup" );
const qrButtons = $( '.qr-button' );
const popupClose = $( '.popup > a.close' ).on( "click", () => popup.removeClass( "visible" ) );

qrButtons.each( ( i, elem ) =>
{
    $( elem ).on( 'click', () =>
    {
        const link = $( elem ).attr( "data-link" );
        if ( popup.hasClass( "visible" ) )
            popup.removeClass( "visible" );
        $( ".popup > .content" ).html( "" );
        $( ".popup > .content" ).qrcode( {
            text: link,
            width: qrSize,
            height: qrSize
        } );
        console.log( qrSize );
        $( ".popup > h2" ).html( getRemark( link ) );
        popup.addClass( "visible" );
    } );
} );

function setRemarks (lang)
{
    const links = $( ".link-remark" );
    links.each( ( i, ele ) =>
    {
        const link = $( ele ).data( "link" );
        $( ele ).html( getRemark( link, lang ) );
    } );
}

function getRemark ( link, lang )
{
    if ( link.startsWith( "http" ) ) return lang == "fa" ? "لینک اشتراک" : "Subscription";
    if ( link.includes( "vmess://" ) )
    {
        const config = JSON.parse( atob( link.replace( "vmess://", "" ) ) );
        return config.ps;
    }
    else return decodeURIComponent( link.split( "#" )[ 1 ] );
}
