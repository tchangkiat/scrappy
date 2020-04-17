const puppeteer = require("puppeteer");
const $ = require("cheerio");
const fs = require("fs");
const config = require("./config.json");
const month_names = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const resultDirectory = "./results";

(async () => {
  if (configCheck()) {
    for (var website of config.websites) {
      await scrap(website);
      await wait(config.delayScrapWebsite);
    }
  }
})();

async function scrap(website) {
  const browser = await puppeteer.launch();
  var scrapResult = {
    website: "",
    generatedOn: "",
    totalPages: 0,
    pages: [],
  };
  var pageMemo = ["/"];
  const websiteq = new URL(website);

  await scrapPage();
  scrapResult.website = website;
  scrapResult.generatedOn = getCurrentDate() + ", " + getCurrentTime();
  scrapResult.totalPages = scrapResult.pages.length;
  scrapResult.pages = scrapResult.pages.sort(function (a, b) {
    return a.level - b.level;
  });

  const fileName =
    website
      .replace("https://", "")
      .replace("http://", "")
      .replace("www.", "")
      .replace(":", "-") +
    " - " +
    getCurrentDate() +
    " - " +
    getCurrentTime().replace(/:/gi, "");

  /*fs.writeFile(
    fileName + ".json",
    JSON.stringify(scrapResult),
    "utf8",
    function (err) {
      if (err) {
        return log(err, 4);
      }

      log(
        "Result has been saved to " + fileName + ".json"
      );
    }
  );*/

  var csvContent =
    "PageLevel,PagePath,PageLoadTime,ObjectUrl,ObjectType,ObjectXCache,ObjectBrowserOrMemoryCache,ObjectCacheControl\n";
  for (let page of scrapResult.pages) {
    var pageInfo =
      '"' + page.level + '","' + page.url + '","' + page.loadTime + '"';
    for (let object of page.objects) {
      csvContent +=
        pageInfo +
        ',"' +
        object.url +
        '","' +
        object.type +
        '","' +
        object.xCache +
        '","' +
        object.browserOrMemoryCache +
        '","' +
        object.cacheControl +
        '"\n';
    }
  }

  if (!fs.existsSync(resultDirectory)) {
    fs.mkdirSync(resultDirectory);
  }
  fs.writeFile(
    resultDirectory + "/" + fileName + ".csv",
    csvContent,
    "utf8",
    function (err) {
      if (err) {
        return log(err, 4);
      }

      log("Result has been saved to " + fileName + ".csv");
    }
  );

  await browser.close();

  async function scrapPage(pagePath = "/", level = 0) {
    if (pagePath == "") return;
    else if (!pagePath.startsWith("/")) pagePath = "/" + pagePath;

    try {
      log("Scraping " + pagePath);

      const page = await browser.newPage();
      var objectsRequested = [];
      page.on("response", (response) => {
        const headers = response.headers();
        const url = response.url();
        objectsRequested.push({
          url: url.startsWith("data:image/")
            ? "(Base64 Value of an Image)"
            : url,
          type: headers["content-type"],
          cacheControl: headers["cache-control"],
          xCache: headers["x-cache"],
          browserOrMemoryCache: response.fromCache(),
        });
      });
      const content = await page
        .goto(websiteq.origin + pagePath)
        .then(function () {
          return page.content();
        });

      const title = $("title", content).text();
      const description = $("meta[name='description']", content).attr(
        "content"
      );
      const perfData = await page.evaluate(() => performance.toJSON());

      scrapResult.pages.push({
        title: title,
        description: description,
        url: pagePath,
        objects: objectsRequested,
        loadTime:
          parseInt(perfData["timing"]["loadEventStart"]) -
          parseInt(perfData["timing"]["navigationStart"]),
        level: level,
      });

      if (config.levelLimit === -1 || level < config.levelLimit) {
        var links = [];
        $("a", content).each(function (index, value) {
          const link = $(value).attr("href");
          if (
            !(
              inMemo(link) ||
              link == "#" ||
              links.includes(link) ||
              isExternalUrl(link, websiteq) ||
              includeListedExtension(link)
            )
          ) {
            links.push(link);
            pageMemo.push(link);
          }
        });

        for (var link of links) {
          await scrapPage(link, level + 1);
          await wait(config.delayScrapPage);
        }
      }

      await page.close();
      return;
    } catch (err) {
      log(err.message, 4);
      return;
    }
  }

  function inMemo(link) {
    if (link == "" || link == undefined) return true;

    return (
      pageMemo.includes(link) ||
      pageMemo.includes(link + "/") ||
      pageMemo.includes("/" + link) ||
      pageMemo.includes(link.substring(0, link.length - 1)) ||
      pageMemo.includes(link.substring(1, link.length))
    );
  }
}

function configCheck() {
  const prefix = "Configuration Check failed: ";

  if (!Number.isInteger(config.levelLimit)) {
    log(prefix + "Level limit must be an Integer", 4);
    return false;
  }

  if (config.levelLimit < -1) {
    log(prefix + "Level limit must be greater than or equal to -1", 4);
    return false;
  }

  if (config.websites.length < 1) {
    log(prefix + "Please indicate at least one website", 4);
    return false;
  }

  if (
    !Number.isInteger(config.delayScrapPage) ||
    !Number.isInteger(config.delayScrapWebsite)
  ) {
    log(
      prefix + "delayScrapPage and/or delayScrapWebsite must be an Integer",
      4
    );
    return false;
  }

  if (config.delayScrapPage < 1000 || config.delayScrapWebsite < 1000) {
    log(
      prefix +
        "delayScrapPage and/or delayScrapWebsite must be greater than or equal to 1000",
      4
    );
    return false;
  }

  return true;
}

function isExternalUrl(url, websiteq) {
  if (url == "" || url == undefined) return true;

  try {
    var match = url.match(
      /^([^:\/?#]+:)?(?:\/\/([^\/?#]*))?([^?#]+)?(\?[^#]*)?(#.*)?/
    );
    if (
      typeof match[1] === "string" &&
      match[1].length > 0 &&
      match[1].toLowerCase() !== websiteq.protocol
    )
      return true;
    if (
      typeof match[2] === "string" &&
      match[2].length > 0 &&
      match[2].replace(
        new RegExp(
          ":(" + { "http:": 80, "https:": 443 }[websiteq.protocol] + ")?$"
        ),
        ""
      ) !== websiteq.host
    )
      return true;
    return false;
  } catch (err) {
    log(err.message, 4);
    return true;
  }
}

function includeListedExtension(url) {
  const splitUrl = url.split("?");
  return (
    splitUrl[0].endsWith(".jpg") ||
    splitUrl[0].endsWith(".jpeg") ||
    splitUrl[0].endsWith(".png") ||
    splitUrl[0].endsWith(".gif") ||
    splitUrl[0].endsWith(".mp4") ||
    splitUrl[0].endsWith(".mov") ||
    splitUrl[0].endsWith(".pdf") ||
    splitUrl[0].endsWith(".zip")
  );
}

function wait(milleseconds) {
  return new Promise((resolve) => setTimeout(resolve, milleseconds));
}

function log(message, type = 1) {
  const typeString =
    type == 2
      ? "WARNING"
      : type == 3
      ? "CRITICAL"
      : type == 4
      ? "ERROR"
      : "INFO";
  const logMessage =
    "[" +
    typeString +
    " - " +
    getCurrentDate() +
    ", " +
    getCurrentTime() +
    "] " +
    message;
  console.log(logMessage);
}

function getCurrentDate() {
  var d = new Date();
  return (
    (d.getDate() < 10 ? "0" : "") +
    d.getDate() +
    " " +
    month_names[d.getMonth()] +
    " " +
    d.getFullYear()
  );
}

function getCurrentTime() {
  var d = new Date();
  return (
    (d.getHours() < 10 ? "0" : "") +
    d.getHours() +
    ":" +
    (d.getMinutes() < 10 ? "0" : "") +
    d.getMinutes() +
    ":" +
    (d.getSeconds() < 10 ? "0" : "") +
    d.getSeconds()
  );
}
