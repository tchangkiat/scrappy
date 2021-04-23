const fs = require("fs");
const config = require("./config.json");
const common = require("./common");
const resultDirectory = "./results";
const { scrape } = require("./scrape.js");

(async () => {
  if (configCheck()) {
    const fileName =
      common.getCurrentDate() +
      " - " +
      common.getCurrentTime().replace(/:/gi, "");
    fs.appendFile(
      resultDirectory + "/" + fileName + ".csv",
      '"Level","Page","Title","Load Time (ms)","jQuery","Object - URL","Object - Type","Object - Status","Object - CSP","Object - X-Cache","Object - Cache-Control","Object - Size (KB)","Remarks"\n',
      "utf8",
      function (err) {
        if (err) {
          return common.log(err, 4);
        }
      }
    );

    for (var website of config.websites) {
      scrapeResult = await scrape(
        website,
        config.levelLimit,
        config.scrapeBudget
      );
      appendResult(fileName, scrapeResult);
      await common.wait(3000);
    }
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

function appendResult(fileName, scrapeResult) {
  if (!fs.existsSync(resultDirectory)) {
    fs.mkdirSync(resultDirectory);
  }

  var csvContent = "";
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

  fs.appendFile(
    resultDirectory + "/" + fileName + ".csv",
    csvContent,
    "utf8",
    function (err) {
      if (err) {
        return common.log(err, 4);
      }
    }
  );
}
