const basePath = process.cwd();
const fs = require("fs");
const path = require("path");
const fastcsv = require("fast-csv");

const exportSetup = (output_folder) => {
  if (fs.existsSync(output_folder)) {
    fs.rmSync(output_folder, { recursive: true });
  }
  fs.mkdirSync(output_folder);
};

const copyImages = (image_folder, output_folder) => {
  const files = fs.readdirSync(image_folder);
  files.forEach((file) => {
    fs.copyFileSync(
      path.join(image_folder, file),
      path.join(output_folder, file)
    );
  });
};

const metadataToCsv = (json, csv) => {
  const json_file = fs.readFileSync(json);
  const metadata = JSON.parse(json_file);

  const trait_types = [];
  metadata.forEach((data) => {
    data.attributes.forEach((attr) => {
      if (trait_types.indexOf(attr.trait_type) === -1) {
        trait_types.push(attr.trait_type);
      }
    });
  });
  const header = ["name", "description", "image"].concat(trait_types);

  const csv_data = metadata.map((data) => {
    const row = new Array(header.length).fill("");
    row[0] = data.name;
    row[1] = data.description;
    row[2] = `./${path.basename(data.image)}`;
    data.attributes.forEach((attr) => {
      row[header.indexOf(attr.trait_type)] = attr.value;
    });
    return row;
  });
  csv_data.splice(0, 0, header);

  const csv_stream = fs.createWriteStream(csv);
  fastcsv
    .write(csv_data)
    .pipe(csv_stream)
    .on("finish", () => {
      console.log("Finish export.");
    });
};

/* Main process */
const output_folder = `${basePath}/export`;
const build_folder = `${basePath}/build`;
const image_folder = `${build_folder}/images`;
const metadata_json = `${build_folder}/json/_metadata.json`;
const metadata_csv = `${output_folder}/metadata.csv`;
exportSetup(output_folder);

copyImages(image_folder, output_folder);
metadataToCsv(metadata_json, metadata_csv);
