const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function loadImagePath() {
    const imagePath = path.join(__dirname, 'image', 'raw', 'image.jpg'); // Замените на фактический путь
    return imagePath;
}

async function sliceImageAndExtractText(imagePath, rows, cols, outputDir, customNames) {
    // Создаем папку, если она не существует
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Получаем информацию о изображении
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    const sliceWidth = Math.floor(width / cols);
    const sliceHeight = Math.floor(height / rows);

    const promises = [];
    const jsonResult = {};

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const left = col * sliceWidth;
            const top = row * sliceHeight;
            const outputFileName = path.join(outputDir, `slice_${row}_${col}.jpg`);

            const extractPromise = sharp(imagePath)
                .extract({ left, top, width: sliceWidth, height: sliceHeight })
                .toFile(outputFileName)
                .then(async () => {
                    // Распознаем текст с помощью Tesseract
                    const { data: { text } } = await Tesseract.recognize(outputFileName, 'rus');

                    // Используем кастомное имя, если оно передано
                    const nameKey = customNames[row * cols + col] || `slice_${row}_${col}`;
                    jsonResult[nameKey] = text.trim();
                });

            promises.push(extractPromise);
        }
    }

    // Ждем, пока все изображения будут созданы и обработаны
    await Promise.all(promises);
    console.log(`Создано и обработано ${rows * cols} изображений в папке "${outputDir}"`);

    // Сохраняем результат в JSON-файл
    const resultFilePath = path.join(outputDir, 'result.json');
    fs.writeFileSync(resultFilePath, JSON.stringify(jsonResult, null, 2));
    console.log(`Результаты сохранены в "${resultFilePath}"`);

    // Удаляем все нарезанные изображения
    await cleanUpImages(outputDir);
}

async function cleanUpImages(outputDir) {
    fs.readdir(outputDir, (err, files) => {
        if (err) {
            console.error('Ошибка при чтении папки:', err);
            return;
        }

        // Фильтруем только JPG файлы и удаляем их
        const deletePromises = files.map(file => {
            if (path.extname(file) === '.jpg') {
                return new Promise((resolve, reject) => {
                    fs.unlink(path.join(outputDir, file), (err) => {
                        if (err) {
                            console.error('Ошибка при удалении файла:', err);
                            reject(err); // Обработка ошибок
                        } else {
                            console.log(`Удален файл: ${file}`);
                            resolve();
                        }
                    });
                });
            }
        });

        // Ждем, пока все файлы будут удалены
        return Promise.all(deletePromises);
    });
}

// Пример использования
(async () => {
    const imagePath = await loadImagePath();
    const outputDir = path.join(__dirname, 'image', 'result');
    const rows = 1; // Задай нужное количество строк
    const cols = 13; // Задай нужное количество столбцов

    const customNames = ['5A', '5B', '6A', '6B', '7A', '7B', '8A', '8B', '9A', '9B', '10A', '10B', '11']; // rows * cols = количество кастомных имен

    await sliceImageAndExtractText(imagePath, rows, cols, outputDir, customNames);
})();
