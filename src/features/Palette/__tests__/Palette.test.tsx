import { render, screen } from '@testing-library/react';
import Palette from '../Palette';

describe('Palette Component', () => {
  it('should render the palette with draggable items', () => {
    render(<Palette />);

    expect(screen.getByText('Перетащите узлы на холст:')).toBeInTheDocument();

    const namespaceItem = screen.getByText('Неймспейс');
    expect(namespaceItem).toBeInTheDocument();
    expect(namespaceItem.closest('div')).toHaveAttribute('draggable', 'true');

    const podGroupItem = screen.getByText('Группа Подов');
    expect(podGroupItem).toBeInTheDocument();
    expect(podGroupItem.closest('div')).toHaveAttribute('draggable', 'true');
  });
});