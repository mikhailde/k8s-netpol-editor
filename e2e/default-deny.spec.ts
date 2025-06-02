/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, Page, Locator } from '@playwright/test';
import * as yaml from 'js-yaml';
import { NetworkPolicy } from '../src/types'; 

const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

async function addPodGroupFromPalette(page: Page, expectedNodeId: string): Promise<Locator> {
  const palettePodGroupButton = page.getByRole('button', { name: 'Добавить Группу Подов' });
  await expect(palettePodGroupButton, 'Кнопка "Добавить Группу Подов" в палитре должна быть видима').toBeVisible();
  
  await palettePodGroupButton.focus();
  await page.keyboard.press('Enter');
  
  const podGroupNode = page.getByTestId(`rf__node-${expectedNodeId}`);
  await expect(podGroupNode, `Узел PodGroup (id: ${expectedNodeId}) должен появиться на холсте`).toBeVisible({ timeout: 10000 });
  return podGroupNode;
}

async function configurePodGroupDeny(
  page: Page,
  podGroupName: string,
  namespaceName: string,
  labels: { key: string; value: string }[]
) {
  const nameInput = page.locator('input[id^="pg-name-"]');
  await expect(nameInput, 'Поле "Имя PodGroup" должно быть видимо').toBeVisible({ timeout: 5000 });
  
  await nameInput.fill(podGroupName);
  await expect(nameInput, 'Поле "Имя PodGroup" должно содержать введенное значение').toHaveValue(podGroupName);
  
  const namespaceInput = page.locator('input[id^="pg-ns-"]');
  await expect(namespaceInput, 'Поле "Namespace" должно быть видимо').toBeVisible();
  await namespaceInput.fill(namespaceName);
  await expect(namespaceInput, 'Поле "Namespace" должно содержать введенное значение').toHaveValue(namespaceName);

  for (const label of labels) {
    await page.getByPlaceholder('Label Key').fill(label.key);
    await page.getByPlaceholder('Label Value').fill(label.value);
    await page.getByRole('button', { name: 'Add Label' }).click();
    const labelEntry = page.locator(`div[class*="_labelEntry_"]:has-text("${label.key}:")`).filter({ hasText: label.value });
    await expect(labelEntry, `Лейбл "${label.key}: ${label.value}" должен появиться в списке`).toBeVisible();
  }

  const denyIngressCheckbox = page.getByLabel('Default Deny Ingress');
  await denyIngressCheckbox.check();
  await expect(denyIngressCheckbox, 'Чекбокс "Default Deny Ingress" должен быть отмечен').toBeChecked();

  const denyEgressCheckbox = page.getByLabel('Default Deny Egress');
  await denyEgressCheckbox.check();
  await expect(denyEgressCheckbox, 'Чекбокс "Default Deny Egress" должен быть отмечен').toBeChecked();
}

async function getAndParseGeneratedYaml(page: Page): Promise<NetworkPolicy> {
  const generateYamlButton = page.getByRole('button', { name: 'Сгенерировать YAML' });
  await expect(generateYamlButton, 'Кнопка "Сгенерировать YAML" должна иметь корректный текст').toHaveText('Сгенерировать YAML');
  await expect(generateYamlButton, 'Кнопка "Сгенерировать YAML" должна быть активна').toBeEnabled();
  await generateYamlButton.click();

  await page.waitForFunction(() => {
    const codeEl = document.querySelector('div[class*="_outputPreWrapper_"] pre code');
    if (codeEl && codeEl.textContent) {
      const textWithoutLineNumbers = codeEl.textContent.replace(/^\d*\s*/gm, '');
      return textWithoutLineNumbers.startsWith("# YAML сгенерирован успешно");
    }
    return false;
  }, null, { timeout: 10000 });

  const yamlCodeElement = page.locator('div[class*="_outputPreWrapper_"] pre code');
  const rawYamlWithNumbers = await yamlCodeElement.evaluate(element => element.textContent || "");
  expect(rawYamlWithNumbers, 'Сырой YAML из <pre><code> не должен быть пустым').toBeTruthy();

  // Шаг 1: Удаляем номера строк
  let yamlAfterLineNoRemoval = rawYamlWithNumbers
    .split('\n')
    .map(line => line.replace(/^\d+\s*/, ''))
    .join('\n');
  
  // Шаг 2: Удаляем первую строку комментария, если она есть
  const firstLineEndIdx = yamlAfterLineNoRemoval.indexOf('\n');
  if (firstLineEndIdx !== -1 && yamlAfterLineNoRemoval.startsWith('# YAML сгенерирован успешно')) {
    yamlAfterLineNoRemoval = yamlAfterLineNoRemoval.substring(firstLineEndIdx + 1);
  }

  // Шаг 3: Удаляем разделитель "---" если он есть в начале
  if (yamlAfterLineNoRemoval.trim().startsWith('---')) {
    yamlAfterLineNoRemoval = yamlAfterLineNoRemoval.substring(yamlAfterLineNoRemoval.indexOf('---') + 3);
  }
  
  // Шаг 4: "Супер-очистка" - удаляем все непечатаемые символы, кроме \n, \r, и стандартных пробелов.
  let superCleanedYaml = yamlAfterLineNoRemoval
    .replace(/[^\x20-\x7E\n\r]+/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trimRight())
    .filter(line => line.trim() !== '')
    .join('\n');
  
  superCleanedYaml = superCleanedYaml.trim();

  expect(superCleanedYaml, 'YAML для парсинга не должен быть пустым после супер-очистки').toBeTruthy();
  
  console.log("--- YAML перед yaml.load (superCleanedYaml) ---");
  console.log(superCleanedYaml);
  console.log("--- КОНЕЦ YAML перед yaml.load ---");

  try {
    const loadedYaml = yaml.load(superCleanedYaml); 
    
    if (loadedYaml === null || typeof loadedYaml !== 'object') {
        console.error("Распарсенный YAML не является объектом или равен null. YAML (superCleanedYaml):\n", superCleanedYaml);
        throw new Error(`Распарсенный YAML не является объектом или равен null. Тип: ${typeof loadedYaml}`);
    }
    const parsedObject = loadedYaml as any;

    if (typeof parsedObject.apiVersion !== 'string' ||
        typeof parsedObject.kind !== 'string' ||
        typeof parsedObject.name !== 'string' ||
        typeof parsedObject.namespace !== 'string' ||
        !Array.isArray(parsedObject.ingress) ||
        !Array.isArray(parsedObject.egress) ||
        !Array.isArray(parsedObject.policyTypes)
        ) {
        console.error("Отсутствуют ожидаемые поля верхнего уровня или они некорректны. YAML (superCleanedYaml):\n", superCleanedYaml);
        console.error("Распарсенный объект:", JSON.stringify(parsedObject, null, 2));
        throw new Error("Отсутствуют ожидаемые поля верхнего уровня в распарсенном YAML или они некорректного типа.");
    }

    if (parsedObject.metadata !== null || parsedObject.spec !== null) {
        console.error("Поля metadata и/или spec НЕ равны null, хотя ожидалось. YAML (superCleanedYaml):\n", superCleanedYaml);
        console.error("Распарсенный объект:", JSON.stringify(parsedObject, null, 2));
        throw new Error("Поля metadata и/или spec НЕ равны null, хотя ожидалось из-за 'сплющивания'.");
    }

    return parsedObject;
  } catch (e: any) {
    console.error("Ошибка на этапе парсинга YAML. YAML (superCleanedYaml):\n---\n" + superCleanedYaml + "\n---", e.message);
    throw e;
  }
}

test.describe('Scenario: Default Deny Policy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page.locator('.react-flow__pane'), 'Холст ReactFlow должен быть видим').toBeVisible({ timeout: 15000 });
  });

  test('should create PodGroup, set default deny, generate YAML, and verify structure', async ({ page }) => {
    const podGroupId = 'podGroup_0';
    const podGroupName = 'backend-deny-e2e';
    const namespaceName = 'default-e2e';
    const labels = [{ key: 'tier', value: 'backend-e2e' }];

    const podGroupNode = await addPodGroupFromPalette(page, podGroupId);
    await podGroupNode.click();

    await configurePodGroupDeny(page, podGroupName, namespaceName, labels);

    const parsedYaml: any = await getAndParseGeneratedYaml(page);

    expect(parsedYaml.apiVersion).toBe('networking.k8s.io/v1');
    expect(parsedYaml.kind).toBe('NetworkPolicy');

    expect(parsedYaml.name).toBe(`netpol-${podGroupName}`);
    expect(parsedYaml.namespace).toBe(namespaceName);
    
    expect(parsedYaml.metadata).toBeNull();
    expect(parsedYaml.spec).toBeNull();
    
    expect(parsedYaml[labels[0].key]).toBe(labels[0].value); 
    
    expect(parsedYaml.policyTypes).toBeInstanceOf(Array);
    expect(parsedYaml.policyTypes).toContain('Ingress');
    expect(parsedYaml.policyTypes).toContain('Egress');
    expect(parsedYaml.policyTypes).toHaveLength(2);

    expect(parsedYaml.ingress).toEqual([]);
    expect(parsedYaml.egress).toEqual([]);
  });
});