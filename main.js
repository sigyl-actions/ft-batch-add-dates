const { promises: fs } = require('fs');
const path = require('path')

const core = require('@actions/core');
// const xmlFormatter = require('ftbatch-strip-datester');
var convert = require('xml-js');

var xpath = require('xpath');
var dom = require('@xmldom/xmldom').DOMParser;

var yaml = require('js-yaml');

const select = xpath.useNamespaces({ ra: 'urn:Rockwell/MasterRecipe' });

const add = (xpath, xml, node) =>
  select(
    xpath,
    xml,
  )[0].appendChild(
    xml
      .createTextNode(
        node,
      ),
  );

async function run() {
  try {
    const regex = new RegExp(
      core.getInput('regex') || '^.+\.(([pP][xX][mM][lL]))$' || '.',
    )
    const directory = core.getInput('folder') || './recipes'

    fs.readFile(
      `${directory}/recipes.yml`,
      'utf8',
    ).then(
      (buffer) => yaml
        .load(
          buffer.toString(),
        )
    ).then(
      (yml) => Promise.all(
        Object.keys(
          yml,
        ).map(
          (filePath) => fs.readFile(
            filePath,
            'utf8',
          )
          .then(
            (buffer) => new dom().parseFromString(
              buffer.toString(),
              'text/xml',
            )
          ).then(
            (xml) => {
              add(
                '/ra:RecipeElement/ra:Header/ra:AreaModelDate',
                xml,
                yml[filePath].AreaModelDate
              );
              add(
                '/ra:RecipeElement/ra:Header/ra:VerificationDate',
                xml,
                yml[filePath].VerificationDate
              );
              return fs.writeFile(
                filePath,
                xml.toString(),
              );
            }
          )
        )
      )
    )
    return;
    fs.readdir(
      directory,
      { withFileTypes: true },
    )
      .then(
        (dirents) => dirents
          .filter(
            (dirent) => dirent.isFile(),
          )
          .map(
            ({
              name,
            }) => name,
          )
      )
      .then(
        (files) => Promise.all(
          files.filter(
            (file) => file.match(regex)
          ).map(
            (file) => path.join(
              directory,
              file,
            ),
          )
            .map(
              (filePath) => fs.readFile(
                filePath,
                'utf8',
              ).then(
                (buffer) => ({
                  filePath,
                  xml: new dom().parseFromString(
                    buffer.toString(),
                    'text/xml',
                  ),
                }),
              ),
            )
        )
      )
      .then(
        (files) => files
          .map(
            ({
              filePath,
              xml,
            }) => ({
              filePath,
              areaModelDate: remove(
                '/ra:RecipeElement/ra:Header/ra:AreaModelDate/text()',
                xml,
              ),
              verificationDate: remove(
                '/ra:RecipeElement/ra:Header/ra:VerificationDate/text()',
                xml,
              ),
              xml,
            })
          )
      )
      .then(
        (docs) => fs.writeFile(
          `${core.getInput('folder')}/recipes.yml`,
          yaml.dump(
            docs
              .reduce(
                (
                  acc,
                  {
                    xml,
                    filePath,
                    ...rest
                  },
                ) => ({
                  ...acc,
                  [filePath]: rest,
                }),
                {},
              )
          ),
        ).then(
          () =>  Promise.all(
            docs
              .map(
                (
                  {
                    filePath,
                    xml,
                  }
                ) => fs.writeFile(
                  filePath,
                  xml.toString(),
                ),
              )
          )
        )
      )
      .catch(
        (ex) => {
          console.log(ex)
          core.setFailed(ex.message)
        },
      );
  }
  catch (error) {
    core.setFailed(error.message);
  }
}

run()
