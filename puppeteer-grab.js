const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

exports.handler = async ( event, context, callback ) => {
  let result = null;
  let browser = null;

  try {

  var address = event.queryStringParameters.addr;
  var grab_geo_url = "https://map.toronto.ca/geoservices/rest/search/rankedsearch?searchArea=1&matchType=1&projectionType=1&retRowLimit=10&searchString=" + encodeURIComponent(address);

  browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
  });

  let geoPage = await browser.newPage();
  await geoPage.goto(grab_geo_url);
  const geo_coords = await geoPage.evaluate( () => {
    return JSON.parse( document.querySelector('pre').innerHTML );
  });
  var latLngAppend = "&lat=" + geo_coords.result.bestResult[0].latitude + "&lng=" + geo_coords.result.bestResult[0].longitude;

  var url = "https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/collection-schedule/?addr=" + encodeURIComponent(address) + latLngAppend;

  let page = await browser.newPage();
  await page.goto(url);
  await page.waitFor('#calendarData img')

  var response = {
    "statusCode": 501,
    "body": "{'nextType': '', 'nextCollection': ''}",
    "isBase64Encoded": false
  };

  const nextPickup = await page.evaluate( () => {
    let listHdrs = Array.from( document.querySelectorAll('#calendarData p.listinghdr') );
    let pickupDates = listHdrs.map( function(item,index) { return item.innerHTML; });
    return pickupDates;
  });

  const nextUp = await page.evaluate( () => {
    let imgElements = Array.from( document.querySelectorAll('#calendarData img') );
    let nexttitle = imgElements.map( function(item, index) {
      return item.title;
    });
    return nexttitle;
  });
    response.statusCode = "200";
    response.body = '{"nextType": "' + nextUp[1] + '", "nextCollection": "' + nextPickup[1] + '"}';
    callback(null, response);
  } catch (err) {
    response.body.errMsg = err;
    callback( null, response );
    return context.fail(err);
  } finally {
    if ( browser !== null ) { await browser.close(); }
  }

  return false;
};
