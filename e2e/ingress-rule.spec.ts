import { test, expect, Page, Locator } from '@playwright/test';

// --- Константы ---
const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';
const DEFAULT_NS = 'default';
const BACKEND_LABELS = { app: 'backend' };
const FRONTEND_LABELS = { app: 'frontend' };
const TARGET_PORT = '8080';
const TARGET_PROTOCOL = 'TCP';

// --- Хелпер-функция для создания и настройки PodGroup ---
async function createPodGroup(
  page: Page,
  expectedNodeId: string,
  labels: { [key: string]: string },
  namespace: string
): Promise<Locator> {
  await page.getByRole('button', { name: 'Перетащить Группу Подов на холст' }).dragTo(page.locator('.reactflow-wrapper'));

  const newNodeTestId = `rf__node-${expectedNodeId}`;
  const newNode = page.getByTestId(newNodeTestId);

  await expect(newNode, `Node ${newNodeTestId} should be visible.`).toBeVisible({ timeout: 15000 });
  await newNode.click();

  const namespaceInput = page.locator('input[id^="ns-"]');
  await expect(namespaceInput, 'Namespace input should be visible.').toBeVisible();
  await namespaceInput.fill(namespace);

  for (const [key, value] of Object.entries(labels)) {
    await page.getByPlaceholder('Label Key').fill(key);
    await page.getByPlaceholder('Label Value').fill(value);
    await page.getByRole('button', { name: 'Add Label' }).click();

    const labelsListContainer = page.locator('div[class*="_labelsListContainer_"]');
    const specificLabelEntry = labelsListContainer.locator(
      'div[class*="_labelEntry_"]',
      {
        has: page.locator(`span[class*="_labelKey_"]:has-text("${key}:")`),
        hasNot: page.locator('input[type="text"]')
      }
    ).filter({
      has: page.locator(`span[class*="_labelValue_"]:has-text("${value}")`)
    });
    await expect(specificLabelEntry, `Label ${key}:${value} should be visible.`).toBeVisible();
    await expect(specificLabelEntry, `Label ${key}:${value} should appear once.`).toHaveCount(1);
  }
  return newNode;
}

// --- Основной тест ---
test.describe('Scenario 9.2: Allow Ingress with Port/Protocol', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page.locator('.reactflow-wrapper'), 'ReactFlow wrapper should be loaded.').toBeVisible();
  });

  test('should allow ingress from frontend to backend on port 8080/TCP', async ({ page }) => {
    const backendNodeExpectedId = 'podGroup_0';
    const frontendNodeExpectedId = 'podGroup_1';

    // 1. Create Backend PodGroup
    const backendNode = await createPodGroup(page, backendNodeExpectedId, BACKEND_LABELS, DEFAULT_NS);
    const backendNodeIdFromAttr = await backendNode.getAttribute('data-id');
    expect(backendNodeIdFromAttr).toBe(backendNodeExpectedId);
    console.log(`Backend Node ID: ${backendNodeIdFromAttr}`);
    await page.locator('.react-flow__viewport').click({ position: { x: 5, y: 5 }, force: true });

    // 2. Create Frontend PodGroup
    const frontendNode = await createPodGroup(page, frontendNodeExpectedId, FRONTEND_LABELS, DEFAULT_NS);
    const frontendNodeIdFromAttr = await frontendNode.getAttribute('data-id');
    expect(frontendNodeIdFromAttr).toBe(frontendNodeExpectedId);
    console.log(`Frontend Node ID: ${frontendNodeIdFromAttr}`);
    await page.locator('.react-flow__viewport').click({ position: { x: 5, y: 5 }, force: true });

    // 3. Create Edge from Frontend (source) to Backend (target)
    console.log(`Attempting to connect: ${frontendNodeIdFromAttr} (source) to ${backendNodeIdFromAttr} (target)`);

    const sourceHandle = frontendNode.locator('.react-flow__handle-bottom[data-handleid="pg-source-a"]');
    const targetHandle = backendNode.locator('.react-flow__handle-top[data-handleid="pg-target-a"]');

    await expect(sourceHandle, 'Source handle should be visible.').toBeVisible();
    await expect(targetHandle, 'Target handle should be visible.').toBeVisible();

    // --- Попытка соединения с помощью sourceHandle.dragTo(targetHandle) ---
    console.log('Using sourceHandle.dragTo(targetHandle) for edge creation.');
    await sourceHandle.dragTo(targetHandle, {
      timeout: 10000,
    });

    console.log('Waiting after dragTo to allow ReactFlow to process the connection...');
    await page.waitForTimeout(3000);

    console.log('Attempting to find the new edge in DOM using data-testid...');

    const expectedTestIdPart = `rf__edge-edge_${frontendNodeIdFromAttr}pg-source-a-to-${backendNodeIdFromAttr}pg-target-a_`;
    const edgeLocatorByTestId = page.locator(`[data-testid^="${expectedTestIdPart}"]`);

    await expect(edgeLocatorByTestId, `Edge group with data-testid starting with "${expectedTestIdPart}" should be visible.`)
    .toBeVisible({ timeout: 15000 });

    const actualTestId = await edgeLocatorByTestId.getAttribute('data-testid');
    console.log(`Actual data-testid of found edge group: ${actualTestId}`);

    await edgeLocatorByTestId.click({ force: true }); 
    console.log('Force-clicked on the edge group successfully.');

    // 4. Настраиваем Порт и Протокол для ребра
    const addPortButton = page.getByRole('button', { name: 'Добавить порт/протокол' });
    await expect(addPortButton, "'Add Port/Protocol' button should be visible.").toBeVisible();
    await addPortButton.click();

    const firstPortEntry = page.locator('div[class*="_portProtocolEntry_"]').first();
    const portInput = firstPortEntry.locator('input[type="text"]');
    const protocolSelect = firstPortEntry.locator('select');

    await expect(portInput, 'Port input field should be visible.').toBeVisible();
    await portInput.fill(TARGET_PORT);
    await expect(protocolSelect, 'Protocol select field should be visible.').toBeVisible();
    await protocolSelect.selectOption(TARGET_PROTOCOL);

    await expect(portInput, 'Port input should have the correct value.').toHaveValue(TARGET_PORT);
    await expect(protocolSelect, 'Protocol select should have the correct value.').toHaveValue(TARGET_PROTOCOL);

    console.log('Test ingress-rule.spec.ts completed successfully!');
  });
});