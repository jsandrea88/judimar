import fs from "fs";

let fallbackData = null;
const fullItemList = [];
const apiKey = "391D75C6-01EE-463C-8B51-47B2748F8ACD";
// Header configuration
const headers = {
  channel: "las-vegas-market",
};
const failedRec = [];

// Function to fetch data for each letter and '#'
async function fetchExhibitors() {
  const baseUrl = "https://www.lasvegasmarket.com/imc-api/v2/exhibitors/az";

  // Create an array with all letters and '#'
  const characters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "#"];

  // Iterate over the characters array
  for (const az of characters) {
    const url = new URL(baseUrl);
    url.search = new URLSearchParams({
      sc_apikey: apiKey,
      az: az,
    }).toString();

    console.log(az);

    try {
      // Fetch data from the API
      //console.log("fetchExhibitors", baseUrl.toString());
      const response = await fetch(url.toString(), { headers });

      // Check if the response is OK
      if (!response.ok) {
        //console.error(`fetchExhibitors: Failed to fetch data for '${az}':`, response.statusText);
        continue;
      }

      // Parse and log the JSON data
      const data = await response.json();

      for (let index = 0; index < data?.items.length; index++) {
        const element = data?.items[index];
        try {
          // Check if the element is an empty object
          if (element && Object.keys(element).length === 0 && element.constructor === Object) {
            continue; // Skip this iteration
          }

          const extraInfo = await getExibitorDetail(element.exhibitorId, element.lineId, element.type);
          if (extraInfo?.name) {
            element.name2 = extraInfo.name;
            element.exhibitorLocations = extraInfo.exhibitorLocations;
            //console.log("ok");
          } else {
            const moreExtraInfo = await getMoreExtraInfo(element.exhibitorId);
            if (moreExtraInfo?.name) {
              element.name2 = moreExtraInfo.name;
              element.exhibitorLocations = moreExtraInfo.exhibitorLocations;
              //console.log("ok");
            } else {
              const result = fallbackData.find((item) => item.exhibiterId === element.exhibitorId);

              const uniqueList = [...new Set(result.showRooms)]; // Removes duplicates
              const commaSeparated = uniqueList.join(","); // Converts to comma-separated string
              element.name2 = result?.name;
              element.exhibitorLocations = commaSeparated;

              //console.log("ok");
            }
          }

          if (!element.exhibitorLocations) {
            console.log("*** was impossible to get data***");
          }

          fullItemList.push(element);
        } catch (error) {
          console.error(`internal fetchExhibitors: Error fetching data for '${JSON.stringify(element)}':`, error);
          failedRec.push(element);
        }
      }
    } catch (error) {
      console.error(`fetchExhibitors: Error fetching data for '${az}':`, error);
    }
  }
}

async function getExibitorDetail(exhibitorId, lineId, type) {
  const usefulData = { name: null, exhibitorLocations: null };
  const baseUrl = `https://www.lasvegasmarket.com/imc-api/v2/products/search?sc_apikey=${apiKey}`;
  let url = "";
  if (type === "line") {
    url = `${baseUrl}&manufactureId=${lineId}&featured=true&page=1&pageSize=6`;
  } else {
    url = `${baseUrl}&exhibitorId=${exhibitorId}&featured=true&page=1&pageSize=6`;
  }

  try {
    // Fetch data from the API
    //console.log("getExibitorDetail", url.toString());
    const response = await fetch(url.toString(), { headers });

    // Check if the response is OK
    if (!response.ok) {
      //console.error(`Failed to fetch data for '${baseUrl}':`, response.statusText);
    }

    // Parse and log the JSON data
    const data = await response.json();

    if (data?.data?.[0]?.hasOwnProperty("exhibitorLocations")) {
      const uniqueList = [...new Set(data?.data[0].exhibitorLocations)]; // Removes duplicates
      const commaSeparated = uniqueList.join(","); // Converts to comma-separated string

      usefulData.name = data?.data[0].lineName;
      usefulData.exhibitorLocations = commaSeparated;
    }

    return usefulData;
  } catch (error) {
    console.error(`Error fetching data`, error);
  }
}

async function getMoreExtraInfo(exhibitorId) {
  const usefulData = { name: null, exhibitorLocations: null };
  const url = `https://www.lasvegasmarket.com/imc-api/v2/exhibitors/OpenDetails?sc_apikey=${apiKey}&exhibitorIds=${exhibitorId}&pageId=c263733f-2601-448b-b0cb-892922c3d945&`;

  try {
    // Fetch data from the API
    //console.log("getMoreExtraInfo", url.toString());
    const response = await fetch(url.toString(), { headers });

    // Check if the response is OK
    if (!response.ok) {
      //console.error(`getMoreExtraInfo: Failed to fetch data for '${baseUrl}':`, response.statusText);
    }

    // Parse and log the JSON data
    const data = await response.json();
    const iShowRooms = [];
    if (data?.hasOwnProperty("data")) {
      for (let index = 0; index < data?.data[0].companyDetails.activeLeases[0].showrooms.length; index++) {
        const element = data?.data[0].companyDetails.activeLeases[0].showrooms[index];
        iShowRooms.push(`${element.showroomBuildingName}${element.showroom}`);
      }

      usefulData.name = data?.data[0].companyDetails.companyName;
      usefulData.exhibitorLocations = iShowRooms.join(",");
    }

    return usefulData;
  } catch (error) {
    console.error(`getMoreExtraInfo: Error fetching data`, error);
  }
}

async function getFallBackData() {
  const baseUrl = `https://www.lasvegasmarket.com/imc-api/v1/floor-plan/exhibited?floorNumber=1&buildingName=The%20EXPO%20at%20World%20Market%20Ctr&count=500&sc_apikey=${apiKey}&sortType=organizationname-asc&productsOnly=false&shopZioOnly=false`;

  try {
    // Fetch data from the API
    //console.log("getFallBackData", baseUrl.toString());
    const response = await fetch(baseUrl.toString(), { headers });

    // Check if the response is OK
    if (!response.ok) {
      // console.error(`getFallBackData: Failed to fetch data for fallbackdata '${baseUrl}':`, response.statusText);
    }

    // Parse and log the JSON data
    fallbackData = await response.json();
  } catch (error) {
    console.error(`getFallBackData: Error fetching fallbackdata`, error);
  }
}

function writeToDisk(data, outputFile) {
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
  console.log(`Data saved to file.`);
}

// Call the function
await getFallBackData();
writeToDisk(fallbackData, "fallbackData.json");
await fetchExhibitors();
writeToDisk(fullItemList, "exhibitors_data.txt");
writeToDisk(failedRec, "failures.json");
