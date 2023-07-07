const basePath = process.cwd();
const fs = require("fs");
const {
  layersSetup,
  saveImage,
  drawBackground,
  loadLayerImg,
  drawElement,
} = require(`${basePath}/src/main.js`);
const {
  format,
  background,
  layerConfigurations,
  gif,
} = require(`${basePath}/src/config.js`);
const { createCanvas } = require(`${basePath}/node_modules/canvas`);
const HashlipsGiffer = require(`${basePath}/modules/HashlipsGiffer.js`);

const buildDir = `${basePath}/build`;
const canvas = createCanvas(format.width, format.height);
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = format.smoothing;

class LayerElementNotFoundException extends Error {}

const rebuildSetup = () => {
  if (!fs.existsSync(buildDir)) {
    throw Error("Build folder is not found.");
  }
  if (!fs.existsSync(`${buildDir}/json/_metadata.json`)) {
    throw Error("_metadata.json is not found.");
  }
  if (fs.existsSync(`${buildDir}/images`)) {
    fs.rmdirSync(`${buildDir}/images`, { recursive: true });
  }
  fs.mkdirSync(`${buildDir}/images`);
  if (gif.export) {
    if (fs.existsSync(`${buildDir}/gifs`)) {
      fs.rmdirSync(`${buildDir}/gifs`, { recursive: true });
    }
    fs.mkdirSync(`${buildDir}/gifs`);
  }
};

const getAllLayers = () => {
  const results = [];
  for (let i = 0; i < layerConfigurations.length; i++) {
    const layers = layersSetup(layerConfigurations[i].layersOrder);
    results.push(
      ...layers.filter((l) => !results.find((a) => a.name === l.name))
    );
  }
  return results;
};

const getLayerInfo = (metadata, allLayers) =>
  metadata.attributes.map((attr) => {
    const layer = allLayers.find(
      (layer) => layer.name.toLowerCase() === attr.trait_type.toLowerCase()
    );
    let selectedElement = layer.elements.find(
      (e) => e.name.toLowerCase() == attr.value.toLowerCase()
    );
    if (!selectedElement) {
      console.warn(
        `${metadata.edition}: Missing image: ${attr.trait_type}: ${attr.value}`
      );
    }
    return {
      name: layer.name,
      blend: layer.blend,
      opacity: layer.opacity,
      selectedElement,
    };
  });

const chunkedArray = (array, size) =>
  Array.from({ length: Math.ceil(array.length / size) }, (_, index) =>
    array.slice(index * size, index * size + size)
  );

/* Main process */
if (background.generate && !background.static) {
  console.warn(
    "The background is set to generate a background, so the result may be different from what you expect."
  );
}

rebuildSetup();
const allLayers = getAllLayers();

const proc = async () => {
  const concurrentTransmissions = 10;

  const f = fs.readFileSync(`${buildDir}/json/_metadata.json`);
  const json = JSON.parse(f);

  const blockList = chunkedArray(
    Array.from(Array(json.length).keys()).map((i) => json[i]),
    concurrentTransmissions
  );

  for (let i = 0; i < blockList.length; i++) {
    const promiseList = blockList[i].map(async (metadata) => {
      try {
        const layerInfo = getLayerInfo(metadata, allLayers);
        const loadedElements = layerInfo.map((layer) => {
          if (!layer.selectedElement) {
            throw new LayerElementNotFoundException();
          }
          return loadLayerImg(layer);
        });
        const renderObjectArray = await Promise.all(loadedElements);

        ctx.clearRect(0, 0, format.width, format.height);
        let hashlipsGiffer = null;
        if (gif.export) {
          hashlipsGiffer = new HashlipsGiffer(
            canvas,
            ctx,
            `${buildDir}/gifs/${metadata.edition}.gif`,
            gif.repeat,
            gif.quality,
            gif.delay
          );
          hashlipsGiffer.start();
        }

        if (background.generate) {
          drawBackground(ctx);
        }

        renderObjectArray.forEach((renderObject, index) => {
          drawElement(ctx, renderObject, index, 0);
          if (gif.export) {
            hashlipsGiffer.add();
          }
        });
        if (gif.export) {
          hashlipsGiffer.stop();
        }

        saveImage(canvas, metadata.edition);
        fs.writeFileSync(
          `${buildDir}/json/${metadata.edition}.json`,
          JSON.stringify(metadata, null, 2)
        );

        console.log(`Created edition: ${metadata.edition}`);
      } catch (e) {
        if (!(e instanceof LayerElementNotFoundException)) {
          console.error(`Failed edition: ${metadata.edition}`, e);
        }
      }
    });
    await Promise.all(promiseList);
  }
};
proc();
