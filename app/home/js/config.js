class Config {

	constructor() {
		this.getQuickSearchData = this.getQuickSearchData.bind(this);
		this.getSearchEngines = this.getSearchEngines.bind(this);
		this.getWebSites = this.getWebSites.bind(this);
		this.getDockSites = this.getDockSites.bind(this);
	}

	getQuickSearchData = () => {
		const quickSearchData = {
			's/': {
				urlPrefix: 'https://stackoverflow.com/search?q='
			},
			'y/': {
				urlPrefix: 'https://youtube.com/results?search_query='
			},
			'r/': {
				urlPrefix: 'https://reddit.com/r/'
			},
			'w/': {
				urlPrefix: 'https://wikipedia.org/wiki/'
			},
			'u/': {
				urlPrefix: 'https://unsplash.com/s/photos/'
			},
			'n/': {
				urlPrefix: 'https://nhentai.net/g/'	
			}
		};

		return quickSearchData;
	}
	

	getSearchEngines = () => {

		const searchEngines = {
			'google': {
				name: 'Google',
				prefix: 'https://www.google.com/search?q='
			},
			'duckduckgo': {
				name: 'Duckduckgo',
				prefix: 'https://duckduckgo.com/?q='
			},
			'ecosia': {
				name: 'Ecosia',
				prefix: 'https://www.ecosia.org/search?q='
			},
			'yahoo': {
				name: 'Yahoo',
				prefix: 'https://search.yahoo.com/search?p='
			},
			'bing': {
				name: 'Bing',
				prefix: 'https://www.bing.com/search?q='
			}
		};

		return searchEngines;
	}

	getWebSites = () => {
		const webSites = [
			{
				site: 'Reddit',
				icon: 'reddit',
				url: 'https://reddit.com/',
				category: 'social'
			},
			{
				site: 'Github',
				icon: 'github',
				url: 'https://github.com/',
				category: 'development'
			},
			{
				site: 'Facebook',
				icon: 'facebook',
				url: 'https://facebook.com/',
				category: 'social'
			},
			{
				site: 'Gmail',
				icon: 'gmail',
				url: 'https://mail.google.com/',
				category: 'social'
			},
			{
				site: 'Youtube',
				icon: 'youtube',
				url: 'https://youtube.com/',
				category: 'media'
			},
			{
				site: 'GDrive',
				icon: 'gdrive',
				url: 'https://drive.google.com/',
				category: 'cloud'
			},
			{
				site: 'Twitter',
				icon: 'twitter',
				url: 'https://twitter.com/',
				category: 'social'
			},
			{
				site: 'Instagram',
				icon: 'instagram',
				url: 'https://instagram.com/',
				category: 'social'
			},
			{
				site: 'Bitbucket',
				icon: 'bitbucket',
				url: 'https://bitbucket.org/',
				category: 'development'
			},
			{
				site: 'Gitlab',
				icon: 'gitlab',
				url: 'https://gitlab.com/',
				category: 'development'
			},
			{
				site: 'Deviantart',
				icon: 'deviantart',
				url: 'https://deviantart.com/',
				category: 'design'
			},
			{
				site: 'Duckduckgo',
				icon: 'duckduckgo',
				url: 'https://duckduckgo.com/',
				category: 'development'
			},
			{
				site: 'Ecosia',
				icon: 'ecosia',
				url: 'https://ecosia.org/',
				category: 'search engine'
			},
			{
				site: 'Google',
				icon: 'google',
				url: 'https://google.com/',
				category: 'search engine'
			},
			{
				site: 'Wikipedia',
				icon: 'wikipedia',
				url: 'https://wikipedia.org/',
				category: 'information'
			},
			{
				site: 'Unsplash',
				icon: 'unsplash',
				url: 'https://unsplash.com/',
				category: 'design'
			},
			{
				site: 'Twitch',
				icon: 'twitch',
				url: 'https://twitch.tv/',
				category: 'media'
			},
			{
				site: 'Yahoo',
				icon: 'yahoo',
				url: 'https://mail.yahoo.com/',
				category: 'social'
			},
			{
				site: 'Material.io',
				icon: 'materialio',
				url: 'https://material.io/',
				category: 'design'
			},
			{
				site: 'Office 365',
				icon: 'office365',
				url: 'https://office.com/',
				category: 'information'
			},
			{
				site: 'Discord',
				icon: 'discord',
				url: 'https://discord.com/',
				category: 'social'
			},
			{
				site: 'Spotify',
				icon: 'spotify',
				url: 'https://spotify.com/',
				category: 'media'
			},
			{
				site: 'JSFiddle',
				icon: 'jsfiddle',
				url: 'https://jsfiddle.net/',
				category: 'development'
			},
			{
				site: 'Figma',
				icon: 'figma',
				url: 'https://figma.com/',
				category: 'design'
			},
			{
				site: 'Stackoverflow',
				icon: 'stackoverflow',
				url: 'https://stackoverflow.com/',
				category: 'development'
			},
			{
				site: 'Stackexchange',
				icon: 'stackexchange',
				url: 'https://stackexchange.com/',
				category: 'development'
			},
			{
				site: 'Superuser',
				icon: 'superuser',
				url: 'https://superuser.com/',
				category: 'development'
			},
			{
				site: 'Calendar',
				icon: 'calendar',
				url: 'https://calendar.google.com/',
				category: 'social'
			},
			{
				site: 'Messenger',
				icon: 'messenger',
				url: 'https://messenger.com/',
				category: 'social'
			},
			{
				site: 'Icons8',
				icon: 'icons8',
				url: 'https://icons8.com/',
				category: 'design'
			},
			{
				site: 'Markdown Cheatsheet',
				icon: 'markdown',
				url: 'https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet/',
				category: 'development'
			},
			{
				site: 'Interneting is Hard',
				icon: 'interneting-is-hard',
				url: 'https://internetingishard.com/',
				category: 'development'
			},
			{
				site: 'Keycode',
				icon: 'keycode',
				url: 'https://keycode.info/',
				category: 'development'
			},
			{
				site: 'Soundcloud',
				icon: 'soundcloud',
				url: 'https://soundcloud.com/',
				category: 'media'
			},
			{
				site: 'Flaticon',
				icon: 'flaticon',
				url: 'https://flaticon.com/',
				category: 'design'
			},
			{
				site: 'Wikimedia Commons',
				icon: 'commons',
				url: 'https://commons.wikimedia.org/',
				category: 'design'
			},
			{
				site: 'MEGA',
				icon: 'mega',
				url: 'https://mega.nz/',
				category: 'cloud'
			},
			{
				site: 'MDN Web Docs',
				icon: 'mdn',
				url: 'https://developer.mozilla.org/',
				category: 'development'
			},
			{
				site: 'Telegram',
				icon: 'telegram',
				url: 'https://web.telegram.org/z/',
				category: 'social'
			},
		];

		return webSites;
	}

	getDockSites = () => {
		const dockSites = [
			{
				site: 'Telegram',
				icon: 'telegram',
				url: 'https://web.telegram.org/z/'
			},
			{
				site: 'Github',
				icon: 'github',
				url: 'https://github.com/'
			},
			{
				site: 'Reddit',
				icon: 'reddit',
				url: 'https://reddit.com/'
			},
			{
				site: 'Youtube',
				icon: 'youtube',
				url: 'https://youtube.com/'
			},
			{
				site: 'Gmail',
				icon: 'gmail',
				url: 'https://mail.google.com/'
			},
			{
				site: 'GDrive',
				icon: 'gdrive',
				url: 'https://drive.google.com/'
			},
			{
				site: 'Twitter',
				icon: 'twitter',
				url: 'https://twitter.com/'
			},
			{
				site: 'Material.io',
				icon: 'materialio',
				url: 'https://material.io/'
			}
		];

		return dockSites;
	}
}
