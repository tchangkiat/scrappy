const puppeteer = require("puppeteer");
const $ = require("cheerio");
const fs = require("fs");
const config = require("./config.json");
const common = require("./common");

const resultDirectory = "./results";

(async () => {
  if (configCheck()) {
    for (var website of config.websites) {
      await scrap(website);
      await common.wait(1000);
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
  website = trimLink(website, true);
  const websiteq = new URL(website);

  await scrapPage();
  scrapResult.website = website;
  scrapResult.generatedOn =
    common.getCurrentDate() + ", " + common.getCurrentTime();
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
    common.getCurrentDate() +
    " - " +
    common.getCurrentTime().replace(/:/gi, "");

  /*fs.writeFile(
    fileName + ".json",
    JSON.stringify(scrapResult),
    "utf8",
    function (err) {
      if (err) {
        return common.log(err, 4);
      }

      common.log(
        "Result has been saved to " + fileName + ".json"
      );
    }
  );*/

  var csvContent =
    '"Page - Level","Page - Path","Page - Title","Page - Load Time","Object - Url","Object - Type","Object - Status","Object - X-Cache","Object - Local Cache","Object - Cache-Control","Object - Size (KB)","Object - Time Taken (MS)"\n';
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
        object.timeTaken +
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
        return common.log(err, 4);
      }

      common.log("Result has been saved to " + fileName + ".csv");
    }
  );

  await browser.close();

  async function scrapPage(pagePath = "/", level = 0) {
    if (pagePath == "") return;

    try {
      common.log("Scraping " + pagePath);
      const page = await browser.newPage();

      var objectsRequested = [];
      var requestStart;
      await page.setRequestInterception(true);
      await page.on("request", (request) => {
        requestStart = Date.now();
        request.continue();
      });
      await page.on("response", async (response) => {
        const headers = response.headers();
        const url = response.url();
        const buffer = await response.buffer();
        objectsRequested.push({
          url: url.startsWith("data:image/")
            ? "(Base64 Value of an Image)"
            : url,
          type: headers["content-type"],
          status: response.status(),
          cacheControl: headers["cache-control"],
          xCache: headers["x-cache"],
          localCache: response.fromCache(),
          size: buffer.length,
          timeTaken: Date.now() - requestStart,
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
          const link = trimLink($(value).attr("href"));
          if (
            !(
              pageMemo.includes(link) ||
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
          await common.wait(250);
        }
      }

      await page.close();
    } catch (err) {
      common.log(err.message, 4);
    } finally {
      return;
    }
  }

  function trimLink(link, origin = false) {
    if (link == "" || link == undefined) return link;

    link = link.split("#")[0];
    if (!origin) link = link.replace(website, "");

    while (link.endsWith("/")) {
      link = link.substring(0, link.length - 1);
    }

    if (link.startsWith("http")) return link;

    if (!link.startsWith("/")) {
      link = "/" + link;
    }
    return link;
  }
}

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
    common.log(err.message, 4);
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
