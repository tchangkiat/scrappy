/*
  Config
*/
const websites = ["http://localhost:3000"];
const levelLimit = 1;
const delayScrapPage = 1000;
const delayScrapWebsite = 1000;
const resultDirectory = "./results";

const puppeteer = require("puppeteer");
const $ = require("cheerio");
const fs = require("fs");
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

(async () => {
  for (var website of websites) {
    await scrap(website);
    await wait(delayScrapWebsite);
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

  await scrapPage(website + "/");
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
    "PageLevel,PageUrl,PageLoadTime,ObjectUrl,ObjectType,ObjectXCache,ObjectCacheControl\n";
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

  async function scrapPage(pageUrl, level = 0) {
    try {
      log("Scraping " + pageUrl);
      const pageq = new URL(pageUrl);

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
        });
      });
      const content = await page.goto(pageUrl).then(function () {
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
        url: pageUrl,
        objects: objectsRequested,
        loadTime:
          parseInt(perfData["timing"]["loadEventStart"]) -
          parseInt(perfData["timing"]["navigationStart"]),
        level: level,
      });

      if (levelLimit === -1 || level < levelLimit) {
        var links = [];
        $("a", content).each(function (index, value) {
          const link = $(value).attr("href");
          if (
            !(
              pageMemo.includes(link) ||
              link == "#" ||
              links.includes(link) ||
              isExternalUrl(link, pageq) ||
              includeListedExtension(link)
            )
          ) {
            links.push(link);
            pageMemo.push(link);
          }
        });

        for (var link of links) {
          await scrapPage(pageq.origin + link, level + 1);
          await wait(delayScrapPage);
        }
      }

      await page.close();
      return;
    } catch (err) {
      log(err.message, 4);
      return;
    }
  }
}

function isExternalUrl(url, pageq) {
  try {
    var match = url.match(
      /^([^:\/?#]+:)?(?:\/\/([^\/?#]*))?([^?#]+)?(\?[^#]*)?(#.*)?/
    );
    if (
      typeof match[1] === "string" &&
      match[1].length > 0 &&
      match[1].toLowerCase() !== pageq.protocol
    )
      return true;
    if (
      typeof match[2] === "string" &&
      match[2].length > 0 &&
      match[2].replace(
        new RegExp(
          ":(" + { "http:": 80, "https:": 443 }[pageq.protocol] + ")?$"
        ),
        ""
      ) !== pageq.host
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
