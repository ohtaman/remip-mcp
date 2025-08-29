export default class ReMIPClient {
  constructor(private readonly remipHost: string, private readonly remipPort: number) {
    this.remipHost = remipHost;
    this.remipPort = remipPort;
  }

  async getRemipInfo() {
    const response = await fetch(`http://${this.remipHost}:${this.remipPort}/health`);
    return response.json();
  }
}
