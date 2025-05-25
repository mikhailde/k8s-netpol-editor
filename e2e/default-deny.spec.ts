import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5173/');
});

test.describe('Scenario 9.1: Create default deny policy', () => {
  test('should create a PodGroup with default deny ingress and egress', async ({ page }) => {
    const podGroupName = 'backend-pod-group';
    const namespaceName = 'default';
    const podGroupLabelKey = 'app';
    const podGroupLabelValue = 'backend';

    // 1. Drag PodGroup from palette to canvas
    await page.getByRole('button', { name: 'Перетащить Группу Подов на холст' }).dragTo(page.locator('.reactflow-wrapper'));

    const newNode = page.getByText(/^podGroup-\d+Ошибка!$/);
    await expect(newNode).toBeVisible({ timeout: 10000 });
    await newNode.click();

    // 2. В Инспекторе:
    //    а. Заполнить Namespace
    const namespaceInput = page.locator('input[id^="ns-"]');
    await expect(namespaceInput).toBeVisible();
    await namespaceInput.fill(namespaceName);

    //    б. Добавить Label: app=backend
    const labelKeyInput = page.getByPlaceholder('Label Key');
    const labelValueInput = page.getByPlaceholder('Label Value');
    const addLabelButton = page.getByRole('button', { name: 'Add Label' });

    await expect(labelKeyInput).toBeVisible();
    await labelKeyInput.fill(podGroupLabelKey);
    await expect(labelValueInput).toBeVisible();
    await labelValueInput.fill(podGroupLabelValue);
    await expect(addLabelButton).toBeVisible();
    await addLabelButton.click();

    const labelsListContainer = page.locator('div[class*="_labelsListContainer_"]');
    const specificLabelEntry = labelsListContainer.locator(
      'div[class*="_labelEntry_"]',
      {
        has: page.locator(`span[class*="_labelKey_"]:has-text("${podGroupLabelKey}:")`),
        hasNot: page.locator('input[type="text"]')
      }
    ).filter({
        has: page.locator(`span[class*="_labelValue_"]:has-text("${podGroupLabelValue}")`)
    });

    await expect(specificLabelEntry).toBeVisible();
    await expect(specificLabelEntry).toHaveCount(1);


    //    в. Установить Default Deny Ingress
    const denyIngressCheckboxLocator = page.getByLabel('Default Deny Ingress');
    await expect(denyIngressCheckboxLocator).toBeVisible();
    await denyIngressCheckboxLocator.check();
    await expect(denyIngressCheckboxLocator).toBeChecked();

    //    г. Установить Default Deny Egress
    const denyEgressCheckboxLocator = page.getByLabel('Default Deny Egress');
    await expect(denyEgressCheckboxLocator).toBeVisible();
    await denyEgressCheckboxLocator.check();
    await expect(denyEgressCheckboxLocator).toBeChecked();
  });
});
