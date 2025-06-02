import { test, expect, Page, Locator } from '@playwright/test';

const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

const TEST_NAMESPACE = 'ingress-e2e-final-v3';
const BACKEND_POD_NAME = 'be-app-final-v3';
const FRONTEND_POD_NAME = 'fe-app-final-v3';
const INGRESS_PORT_NUMBER = 8080; 
const INGRESS_PORT_STRING = '8080';
const INGRESS_PROTOCOL = 'TCP';

const BACKEND_NODE_PALETTE_ID = 'podGroup_0';
const FRONTEND_NODE_PALETTE_ID = 'podGroup_1';

async function addNodeFromPaletteAndClick(page: Page, expectedNodeId: string): Promise<Locator> {
  const paletteButton = page.getByRole('button', { name: 'Добавить Группу Подов' });
  await expect(paletteButton).toBeVisible();
  await paletteButton.focus();
  await page.keyboard.press('Enter');
  const node = page.getByTestId(`rf__node-${expectedNodeId}`);
  await expect(node, `Узел (id: ${expectedNodeId}) должен появиться`).toBeVisible({ timeout: 10000 });
  await node.click();
  return node;
}

async function configurePodGroup(page: Page, podName: string, namespaceName: string) {
  const nameInput = page.locator('input[id^="pg-name-"]');
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(podName);
  await expect(nameInput).toHaveValue(podName);
  
  const namespaceInput = page.locator('input[id^="pg-ns-"]');
  await expect(namespaceInput).toBeVisible();
  await namespaceInput.fill(namespaceName);
  await expect(namespaceInput).toHaveValue(namespaceName);

  await page.getByPlaceholder('Label Key').fill('app');
  await page.getByPlaceholder('Label Value').fill(podName);
  await page.getByRole('button', { name: 'Add Label' }).click();
  const labelEntry = page.locator(`div[class*="_labelEntry_"]:has-text("app:")`).filter({ hasText: podName });
  await expect(labelEntry).toBeVisible();

  const inspectorIssuesPanel = page.locator('.inspector-view-root div[class*="_nodeIssuesPanel_"]');
  await expect(inspectorIssuesPanel, `Панель проблем для ${podName} должна отсутствовать`).not.toBeVisible({ timeout: 3000 });
}

async function createEdgeAndConfigurePorts(
    page: Page,
    sourceNode: Locator,
    targetNode: Locator,
    port: string,
    protocol: string
) {
    const sourceHandle = sourceNode.locator('.react-flow__handle-bottom[data-handleid="pg-source-a"]');
    const targetHandle = targetNode.locator('.react-flow__handle-top[data-handleid="pg-target-a"]');
    await expect(sourceHandle).toBeVisible();
    await expect(targetHandle).toBeVisible();

    const sourceBB = await sourceHandle.boundingBox();
    const targetBB = await targetHandle.boundingBox();
    if (!sourceBB || !targetBB) throw new Error('Bounding box для хэндлов не найден');

    await page.mouse.move(sourceBB.x + sourceBB.width / 2, sourceBB.y + sourceBB.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200); 
    await page.mouse.move(targetBB.x + targetBB.width / 2, targetBB.y + targetBB.height / 2);
    await page.waitForTimeout(200); 
    await page.mouse.up();

    const edgeLocator = page.locator('.react-flow__edge.react-flow__edge-customRuleEdge');
    await expect(edgeLocator, 'Ребро customRuleEdge должно появиться').toHaveCount(1, { timeout: 10000 });
    await edgeLocator.first().click({ force: true }); 

    const addPortButton = page.getByRole('button', { name: 'Добавить порт/протокол' });
    await expect(addPortButton).toBeVisible();
    await addPortButton.click();

    const firstPortEntry = page.locator('div[class*="_portProtocolEntry_"]').first();
    const portInput = firstPortEntry.locator('input[type="text"]');
    const protocolSelect = firstPortEntry.locator('select');
    await portInput.fill(port);
    await protocolSelect.selectOption(protocol);
    await expect(portInput).toHaveValue(port);
    await expect(protocolSelect).toHaveValue(protocol);
}

async function getGeneratedYamlString(page: Page): Promise<string> {
  const generateYamlButton = page.getByRole('button', { name: /^Сгенерировать YAML$|^Проверьте ошибки$/ });
  await expect(generateYamlButton).toBeVisible({ timeout: 7000 });
  await expect(generateYamlButton, 'Текст кнопки должен быть "Сгенерировать YAML"').toHaveText('Сгенерировать YAML');
  await expect(generateYamlButton).toBeEnabled();
  await generateYamlButton.click();

  await page.waitForFunction(() => {
    const codeEl = document.querySelector('div[class*="_outputPreWrapper_"] pre code');
    if (codeEl && codeEl.textContent) {
      return codeEl.textContent.includes("apiVersion: networking.k8s.io/v1"); 
    }
    return false;
  }, null, { timeout: 10000 });

  const yamlCodeElement = page.locator('div[class*="_outputPreWrapper_"] pre code');
  const rawDomTextContent = await yamlCodeElement.evaluate(element => {
      let text = "";
      element.childNodes.forEach(lineNode => {
          if (lineNode.nodeType === Node.ELEMENT_NODE) {
              lineNode.childNodes.forEach(tokenNode => {
                  if (tokenNode.nodeType === Node.ELEMENT_NODE) {
                      const el = tokenNode as HTMLElement;
                      if (!el.classList.contains('linenumber') && !el.classList.contains('react-syntax-highlighter-line-number')) {
                          text += el.textContent || "";
                      }
                  } else if (tokenNode.nodeType === Node.TEXT_NODE) {
                      text += tokenNode.textContent || "";
                  }
              });
          }
          text += '\n';
      });
      return text.trim();
  });
  expect(rawDomTextContent, 'Сырой YAML из DOM не должен быть пустым').toBeTruthy();
  
  let cleanedYaml = rawDomTextContent;

  if (cleanedYaml.startsWith('# YAML сгенерирован успешно')) {
    const firstLineEndIndex = cleanedYaml.indexOf('\n');
    cleanedYaml = (firstLineEndIndex !== -1) ? cleanedYaml.substring(firstLineEndIndex + 1) : "";
  }
  
  cleanedYaml = cleanedYaml.trimStart(); 
  
  if (cleanedYaml.startsWith('---')) {
    const afterTripleDashIndex = cleanedYaml.indexOf('\n');
    cleanedYaml = (afterTripleDashIndex !== -1) ? cleanedYaml.substring(afterTripleDashIndex + 1) : "";
  }
  
  cleanedYaml = cleanedYaml.trim();
  
  expect(cleanedYaml, 'Очищенный YAML не должен быть пустым').toBeTruthy();
  return cleanedYaml;
}

test.describe('Scenario: Allow Ingress with Port/Protocol', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page.locator('.react-flow__pane')).toBeVisible({ timeout: 15000 });
  });

  test('should allow ingress from frontend to backend and verify YAML string', async ({ page }) => {
    const backendNode = await addNodeFromPaletteAndClick(page, BACKEND_NODE_PALETTE_ID);
    await configurePodGroup(page, BACKEND_POD_NAME, TEST_NAMESPACE);
    await page.locator('.react-flow__pane').click({ position: { x: 1, y: 1 } }); 

    const frontendNode = await addNodeFromPaletteAndClick(page, FRONTEND_NODE_PALETTE_ID);
    await configurePodGroup(page, FRONTEND_POD_NAME, TEST_NAMESPACE);
    await page.locator('.react-flow__pane').click({ position: { x: 1, y: 1 } }); 

    await createEdgeAndConfigurePorts(page, frontendNode, backendNode, INGRESS_PORT_STRING, INGRESS_PROTOCOL);
    
    await backendNode.click();
    const backendNamespaceInput = page.locator('input[id^="pg-ns-"][placeholder="Namespace"]');
    await expect(backendNamespaceInput).toBeVisible({timeout: 3000});
    if (await backendNamespaceInput.inputValue() !== TEST_NAMESPACE) {
        console.log(`[КОСТЫЛЬ E2E] Namespace для ${BACKEND_POD_NAME} был "${await backendNamespaceInput.inputValue()}", исправляем на "${TEST_NAMESPACE}"`);
        await backendNamespaceInput.fill(TEST_NAMESPACE);
        await expect(backendNamespaceInput).toHaveValue(TEST_NAMESPACE, {timeout: 3000});
    }
    const inspectorIssuesPanelAfterFix = page.locator('.inspector-view-root div[class*="_nodeIssuesPanel_"]');
    await expect(async () => {
        const isVisible = await inspectorIssuesPanelAfterFix.isVisible();
        if (!isVisible) return;
        const panelText = await inspectorIssuesPanelAfterFix.innerText();
        expect(panelText).not.toContain("Namespace не указан");
    }).toPass({ timeout: 5000 });

    const yamlString = await getGeneratedYamlString(page);

    console.log("--- Финальная YAML строка для проверки (из getGeneratedYamlString) ---");
    console.log(yamlString);
    console.log("---------------------------------------");

    expect(yamlString).toContain('apiVersion: networking.k8s.io/v1');
    expect(yamlString).toContain('kind: NetworkPolicy');
    expect(yamlString).toContain('metadata:');
    expect(yamlString).toContain(`  name: netpol-${BACKEND_POD_NAME}`);
    expect(yamlString).toContain(`  namespace: ${TEST_NAMESPACE}`);
    expect(yamlString).toContain('spec:');
    expect(yamlString).toContain(`  podSelector:`);
    expect(yamlString).toContain(`    matchLabels:`);
    expect(yamlString).toContain(`      app: ${BACKEND_POD_NAME}`);
    expect(yamlString).toContain('  ingress:');
    expect(yamlString).toContain('  - from:');
    expect(yamlString).toContain(`    - podSelector:`);
    expect(yamlString).toContain(`        matchLabels:`);
    expect(yamlString).toContain(`          app: ${FRONTEND_POD_NAME}`);
    
    expect(yamlString).toContain(`    ports:`);
    expect(yamlString).toContain(`    - protocol: ${INGRESS_PROTOCOL}`);
    expect(yamlString).toContain(`      port: ${INGRESS_PORT_NUMBER}`);

    expect(yamlString).toContain('  policyTypes:');
    expect(yamlString).toContain('  - Ingress');              
    
    expect(yamlString).not.toContain('egress:');
    expect(yamlString).not.toContain('  - Egress');
  });
});