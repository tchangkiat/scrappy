const puppeteer = require("puppeteer");
const $ = require("cheerio");
const common = require("./common");

async function scrap(website, levelLimit, budget) {
  const websiteq = new URL(website);

  async function scrapPage(pagePath = "/", level = 0) {
    if (pagePath == "") return;
    if (budget !== 0 && scrapCount >= budget) return;
    scrapCount++;

    common.log("Scraping " + pagePath);
    const page = await browser.newPage();
    var objectsRequested = [];
    const scrapPageStartTime = Date.now();

    try {
      var requestStartTime = {};
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        requestStartTime[request.url()] = Date.now();
        request.continue();
      });

      await page.on("response", async (response) => {
        const url = response.url();
        const headers = response.headers();
        try {
          const buffer = await response.buffer();
          objectsRequested.push({
            url: url.startsWith("data:image/")
              ? "(Base64 Value of an Image)"
              : url,
            type: headers["content-type"],
            status: response.status(),
            cacheControl: headers["cache-control"]
              ? headers["cache-control"].replace(/"/g, "'")
              : "undefined",
            xCache: headers["x-cache"],
            localCache: response.fromCache(),
            size: buffer.length,
            timeTaken: Date.now() - requestStartTime[url],
            remarks: "",
          });
        } catch (err) {
          objectsRequested.push({
            url: url.startsWith("data:image/")
              ? "(Base64 Value of an Image)"
              : url,
            type: headers["content-type"],
            status: response.status(),
            cacheControl: headers["cache-control"]
              ? headers["cache-control"].replace(/"/g, "'")
              : "undefined",
            xCache: headers["x-cache"],
            localCache: response.fromCache(),
            size: "",
            loadTime: Date.now() - requestStartTime[url],
            remarks: "Object Error: " + err.message,
          });
        }
      });

      const content = await page
        .goto(websiteq.origin + pagePath, { waitUntil: "networkidle2" })
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
        remarks: "",
      });

      if (levelLimit === -1 || level < levelLimit) {
        var links = [];
        $("a", content).each(function (index, value) {
          const link = trimLink($(value).attr("href"), website);
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
    } catch (err) {
      scrapResult.pages.push({
        title: "",
        description: "",
        url: pagePath,
        objects: objectsRequested,
        loadTime: Date.now() - scrapPageStartTime,
        level: level,
        remarks: "Page Error: " + err.message,
      });
    } finally {
      await page.close();
    }
  }

  const browser = await puppeteer.launch();
  var scrapResult = {
    website: "",
    generatedOn: "",
    totalPages: 0,
    pages: [],
  };
  var pageMemo = ["/"];
  var scrapCount = 0;
  website = trimLink(website, true);

  await scrapPage();
  scrapResult.website = website;
  scrapResult.generatedOn =
    common.getCurrentDate() + ", " + common.getCurrentTime();
  scrapResult.totalPages = scrapResult.pages.length;
  scrapResult.pages = scrapResult.pages.sort(function (a, b) {
    return a.level - b.level;
  });

  await browser.close();

  return scrapResult;
}

function trimLink(link, website, origin = false) {
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
  var splitUrl = url.split("#");
  splitUrl = splitUrl[0].split("?");
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

module.exports = {
  scrap,
};
