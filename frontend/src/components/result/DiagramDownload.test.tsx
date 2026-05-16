import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DiagramDownload, downloadDrawio } from './DiagramDownload';

describe('downloadDrawio', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns error message when content is empty string', () => {
    const result = downloadDrawio('', 'test.drawio');
    expect(result).toBe('O conteúdo do diagrama está vazio. Não é possível realizar o download.');
  });

  it('returns error message when content is whitespace only', () => {
    const result = downloadDrawio('   ', 'test.drawio');
    expect(result).toBe('O conteúdo do diagrama está vazio. Não é possível realizar o download.');
  });

  it('returns error message when content is malformed base64', () => {
    const result = downloadDrawio('!!!not-valid-base64!!!', 'test.drawio');
    expect(result).toBe('O conteúdo do diagrama está malformado. Não é possível decodificar o arquivo.');
  });

  it('returns null on successful download with valid base64', () => {
    const validBase64 = btoa('<xml>test</xml>');

    // Stub URL APIs (not available in jsdom)
    const mockUrl = 'blob:http://localhost/fake-url';
    URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);
    URL.revokeObjectURL = vi.fn();

    // Track link creation without breaking createElement for other elements
    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: mockClick } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as Node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node as Node);

    const result = downloadDrawio(validBase64, 'architecture.drawio');

    expect(result).toBeNull();
    expect(mockClick).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
  });

  it('uses default filename when none provided', () => {
    const validBase64 = btoa('<xml>test</xml>');

    const mockUrl = 'blob:http://localhost/fake-url';
    URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);
    URL.revokeObjectURL = vi.fn();

    let capturedDownload = '';
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const link = { href: '', download: '', click: vi.fn() };
        Object.defineProperty(link, 'download', {
          get() { return capturedDownload; },
          set(v) { capturedDownload = v; },
        });
        return link as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as Node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node as Node);

    downloadDrawio(validBase64, '');

    expect(capturedDownload).toBe('architecture.drawio');
  });
});

describe('DiagramDownload component', () => {
  it('renders download button with filename', () => {
    render(<DiagramDownload contentBase64={btoa('test')} filename="my-diagram.drawio" />);
    expect(screen.getByRole('button', { name: /download my-diagram\.drawio/i })).toBeInTheDocument();
  });

  it('disables button when contentBase64 is empty', () => {
    render(<DiagramDownload contentBase64="" filename="test.drawio" />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('shows error message when download fails with malformed content', () => {
    render(<DiagramDownload contentBase64="!!!invalid!!!" filename="test.drawio" />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByRole('alert')).toHaveTextContent('malformado');
  });

  it('does not show error initially', () => {
    render(<DiagramDownload contentBase64={btoa('test')} filename="test.drawio" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
