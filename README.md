# scrappy

A script to scrape web pages for header and page object information

## How To Use

1. Clone this repository

2. Run "npm install" command

3. Edit "config.json" to state the level limit and websites to scrape

   - levelLimit (integer): to restrict the level to scraping. E.g. level 0 = index / homepage only, level 1 = all links (to pages) found on the homepage, etc

   - scrapeBudget (integer): to restrict the number of pages to scrape in total. Indicate "0" to scrape all pages. This configuration is still restricted by levelLimit

   - websites (array of string): list of websites to scrape

4. Run "npm start" to start scraping

5. Results can be found in the "results" folder
