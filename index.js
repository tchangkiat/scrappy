const fs = require("fs");
const config = require("./config.json");
const common = require("./common");
const resultDirectory = "./results";
const { scrape } = require("./scrape.js");

(async () => {
  if (configCheck()) {
    var scrapeResults = [];
    for (var website of config.websites) {
      scrapeResults.push(
        await scrape(website, config.levelLimit, config.scrapeBudget)
      );
      await common.wait(3000);
    }
    writeResultToFile(scrapeResults);
  }
})();

function configCheck() {
  const prefix = "Configuration Check failed: ";

  if (!Number.isInteger(config.levelLimit)) {
    common.log(prefix + "Level limit must be an Integer", 4);
    return false;
  }

  if (config.levelLimit < -1) {
    common.log(prefix + "Level limit must be greater than or equal to -1", 4);
    return false;
  }

  if (config.websites.length < 1) {
    common.log(prefix + "Please indicate at least one website", 4);
    return false;
  }

  return true;
}

function writeResultToFile(scrapeResults) {
  const fileName =
    common.getCurrentDate() +
    " - " +
    common.getCurrentTime().replace(/:/gi, "");

  if (!fs.existsSync(resultDirectory)) {
    fs.mkdirSync(resultDirectory);
  }

  var csvContent =
    '"Level","URL","Title","Load Time (ms)","jQuery","Object - URL","Object - Type","Object - Status","Object - CSP","Object - X-Cache","Object - Local Cache","Object - Cache-Control","Object - Size (KB)","Remarks"\n';
  for (let scrapeResult of scrapeResults) {
    for (let page of scrapeResult.pages) {
      var pageInfo =
        '"' +
        page.level +
        '","' +
        page.url +
        '","' +
        page.title +
        '","' +
        page.loadTime +
        '","' +
        page.jquery +
        '"';
      for (let object of page.objects) {
        csvContent +=
          pageInfo +
          ',"' +
          object.url +
          '","' +
          object.type +
          '","' +
          object.status +
          '","' +
          object.csp +
          '","' +
          object.xCache +
          '","' +
          object.localCache +
          '","' +
          object.cacheControl +
          '","' +
          object.size / 1000 +
          '","' +
          ((page.remarks ? page.remarks : "") +
            (page.remarks && object.remarks ? "\n\n" : "") +
            (object.remarks ? object.remarks : "")) +
          '"\n';
      }
    }
  }

  fs.writeFile(
    resultDirectory + "/" + fileName + ".csv",
    csvContent,
    "utf8",
    function (err) {
      if (err) {
        return common.log(err, 4);
      }

      common.log("Result has been saved to " + fileName + ".csv");
    }
  );
}
