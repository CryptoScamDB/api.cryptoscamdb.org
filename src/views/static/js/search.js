function hideEverything() {
    $("#verified").hide();
    $("#blocked").hide();
    $("#neutral").hide();
    $("#helpmessage").hide();
}


window.addEventListener("load", function() {
    $('.search-btn').click(function() {
        console.log('button click recorded')
        $.getJSON("/api/v1/check/" + encodeURIComponent($("input").val().toLowerCase().replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0]), function(result) {
            if (result.result === 'verified') {
                hideEverything();
                var strLinkVerified = '';
                $("#verifiedmessage").html('<b>' + encodeURI($("input").val().toLowerCase().replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0]) + '</b> is a verified domain. You can trust the contents.');
                strLinkVerified = '<a id="details" href="/domain/' + encodeURI($("input").val()) + '">Details on this domain <i class="chevron right small icon"></i></a>';
                $("#verifiedmessage").html($("#verifiedmessage").html() + ' ' + strLinkVerified);
                $("#verified").css('display', 'flex');
            } else if (result.result === 'neutral') {
                hideEverything();
                var strLinkNeutral = '';
                if(result.type === 'address'){
                    $("#neutralmessage").html('<b>' + encodeURI($("input").val().toLowerCase().replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0]) + '</b> wasn\'t a recognized ETH address.');
                    strLinkNeutral = '<a id="details" href="https://etherscan.io/address/' + encodeURI($("input").val()) + '">View this address on Etherscan <i class="chevron right small icon"></i></a>';
                    $("#neutralmessage").html($("#neutralmessage").html() + ' ' + strLinkNeutral);
                    $("#neutral").css('display', 'flex');
                }
                else{
                    $("#neutralmessage").html('<b>' + encodeURI($("input").val().toLowerCase().replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0]) + '</b> wasn\'t recognized as a malicious domain, nor as verified domain. Be careful!');
                    strLinkNeutral = '<a id="details" href="/domain/' + encodeURI($("input").val()) + '">Details on this domain <i class="chevron right small icon"></i></a>';
                    $("#neutralmessage").html($("#neutralmessage").html() + ' ' + strLinkNeutral);
                    $("#neutral").css('display', 'flex');
                }
            } else if (result.result === 'whitelisted') {
                hideEverything();
                var strLinkWhitelisted = '';
                $("#verifiedmessage").html('<b>' + encodeURI($("input").val().toLowerCase().replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0]) + '</b> is a whitelisted address. You can trust it.');
                strLinkWhitelisted = '<a id="details" href="/address/' + encodeURI($("input").val()) + '">Details on this address <i class="chevron right small icon"></i></a>';
                $("#verifiedmessage").html($("#verifiedmessage").html() + ' ' + strLinkWhitelisted);
                $("#verified").css('display', 'flex');
            } else if (result.result === 'blocked') {
                hideEverything();
                blocked = true;
                var strLinkBlocked = '';
                if (result.type === 'domain' && 'category' in result.entries[0]) {
                    $("#blacklistmessage").html('<b>' + encodeURI($("input").val().toLowerCase().replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0]) + '</b> was put on the blacklist for ' + result.entries[0].category.toLowerCase() + '.');
                    strLinkBlocked = '<a id="details" href="/domain/' + encodeURI($("input").val()) + '">Details on this domain <i class="chevron right small icon"></i></a>';
                } else if(result.type === 'address') {
					          $("#blacklistmessage").html('<b>' + encodeURI($("input").val().toLowerCase()) + ' was put on the blacklist and is associated with '+ result.entries.length +' blocked domain(s).');
					          strLinkBlocked = '<a id="details" href="/address/' + encodeURI($("input").val()) + '">Details on this address <i class="chevron right small icon"></i></a>';
				        } else if(result.type === 'ip') {
					          $("#blacklistmessage").html('<b>' + encodeURI($("input").val().toLowerCase().replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0]) + '</b> was put on the blacklist and is associated with '+ result.entries.length +' blocked domain(s)');
					          strLink = '<a id="details" href="/ip/' + encodeURI($("input").val()) + '">Details on this domain <i class="chevron right small icon"></i></a>';
				        }
                $("#blacklistmessage").html($("#blacklistmessage").html() + ' ' + strLinkBlocked);
                $("#blocked").css('display', 'flex');
            }
        });
    });
});
