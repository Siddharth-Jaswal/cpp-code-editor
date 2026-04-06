export const DEFAULT_TEMPLATE = `#include <iostream>
using namespace std;

int main() {
  cout << "Hello World";
  return 0;
}
`;

export const DEFAULT_EDITOR_SETTINGS = {
  fontFamily: 'Consolas, "Courier New", monospace',
  fontSize: 14,
  theme: 'vs-dark',
  accentColor: '#22c55e',
  template: DEFAULT_TEMPLATE,
};
