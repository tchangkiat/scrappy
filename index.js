const fs = require("fs");
const config = require("./config.json");
const common = require("./common");
const resultDirectory = "./results";
const { scrap } = require("./scrap.js");

(async () => {
  if (configCheck()) {
    for (var website of config.websites) {
      const scrapResult = await scrap(
        website,
        config.levelLimit,
        config.scrapBudget
      );
      writeResultToFile(website, scrapResult);
      await common.wait(2000);
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

  if (config.output !== "csv" && config.output !== "json") {
    common.log(prefix + "Only 'CSV' and 'JSON' file format are supported", 4);
    return false;
  }

  if (config.websites.length < 1) {
    common.log(prefix + "Please indicate at least one website", 4);
    return false;
  }

  return true;
}

function writeResultToFile(website, scrapResult) {
  const fileName =
    website
      .replace("https://", "")
      .replace("http://", "")
      .replace("www.", "")
      .replace(":", "-") +
    " - " +
    common.getCurrentDate() +
    " - " +
    common.getCurrentTime().replace(/:/gi, "");

  if (!fs.existsSync(resultDirectory)) {
    fs.mkdirSync(resultDirectory);
  }

  if (config.output === "csv") {
    var csvContent =
      '"Page - Level","Page - Path","Page - Title","Page - Load Time (ms)","Object - Url","Object - Type","Object - Status","Object - X-Cache","Object - Local Cache","Object - Cache-Control","Object - Size (KB)","Object - Load Time (ms)","Remarks"\n';
    for (let page of scrapResult.pages) {
      var pageInfo =
        '"' +
        page.level +
        '","' +
        page.url +
        '","' +
        page.title +
        '","' +
        page.loadTime +
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
          object.xCache +
          '","' +
          object.localCache +
          '","' +
          object.cacheControl +
          '","' +
          object.size / 1000 +
          '","' +
          object.loadTime +
          '","' +
          ((page.remarks ? page.remarks : "") +
            (page.remarks && object.remarks ? "\n\n" : "") +
            (object.remarks ? object.remarks : "")) +
          '"\n';
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
  } else {
    fs.writeFile(
      resultDirectory + "/" + fileName + ".json",
      JSON.stringify(scrapResult),
      "utf8",
      function (err) {
        if (err) {
          return common.log(err, 4);
        }

        common.log("Result has been saved to " + fileName + ".json");
      }
    );
  }
}
