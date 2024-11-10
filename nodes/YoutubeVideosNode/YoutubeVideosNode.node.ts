import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { Client, PlaylistVideos } from 'youtubei';

export class YoutubeVideosNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Youtube Videos',
		name: 'youtubeVideosNode',
		// eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg
		icon: 'file:youTube.png',
		group: ['transform'],
		version: 1,
		description: 'Youtube Videos Node',
		defaults: {
			name: 'Youtube Videos Node',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'channel',
				required: true,
				options: [
					{
						name: 'Get Channel',
						value: 'get_channel',
					},
					{
						name: 'Get Playlist',
						value: 'get_playlist',
					},
					{
						name: 'Get Video',
						value: 'get_video',
					},
					{
						name: 'Load Channel Videos',
						value: 'channel',
					},
					{
						name: 'Load Playlist Videos',
						value: 'playlist',
					},
					{
						name: 'Search Videos',
						value: 'search',
					},
				],
			},
			{
				displayName: 'Channel ID',
				name: 'channel_id',
				type: 'string',
				default: '',
				placeholder: 'Channel ID',
				displayOptions: {
					show: {
						'/operation': ['channel', 'get_channel'],
					},
				},
			},
			{
				displayName: 'Playlist ID',
				name: 'playlist_id',
				type: 'string',
				default: '',
				placeholder: 'Playlist ID',
				displayOptions: {
					show: {
						'/operation': ['playlist', 'get_playlist'],
					},
				},
			},
			{
				displayName: 'Keywords',
				name: 'keywords',
				type: 'string',
				default: '',
				placeholder: 'Keywords',
				displayOptions: {
					show: {
						'/operation': ['search'],
					},
				},
			},
			{
				displayName: 'Page Count',
				name: 'pageCount',
				type: 'number',
				default: 1,
				description: 'The pages to load',
				displayOptions: {
					show: {
						'/operation': ['search'],
					},
				},
			},
			{
				displayName: 'Video ID',
				name: 'video_id',
				type: 'string',
				default: '',
				placeholder: 'Video ID',
				displayOptions: {
					show: {
						'/operation': ['get_video'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const youtube = new Client();

		const generateDetailedError = function(error: any, operation: string, params: Record<string, any>) {
			const details = Object.entries(params)
				.map(([key, value]) => `${key}: ${value}`)
				.join(', ');
			return `Error in operation '${operation}' with parameters [${details}]: ${error.message}`;
		};

		let operation: string;
		let channelId: string;
		let playlistId: string;
		let keywords: string;
		let videoId: string;
		let pageCount: number;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				operation = this.getNodeParameter('operation', itemIndex, '') as string;

				if (operation === 'channel') {
					channelId = this.getNodeParameter('channel_id', itemIndex, '') as string;

					const channel = await youtube.getChannel(channelId);
					let videos = await channel?.videos.next(0);
					if (!videos) {
						videos = [];
					}
					const outputItems = videos.map((video) => ({
						json: {
							id: video.id,
							title: video.title,
							description: video.description,
							thumbnail: video.thumbnails.best,
							channel: {
								id: video.channel?.id,
								name: video.channel?.name,
							},
							viewCount: video.viewCount,
							uploadDate: video.uploadDate,
							duration: video.duration,
						},
						pairedItem: { item: itemIndex },
					}));
					for (const item of outputItems) {
						returnData.push(item);
					}
				} else if (operation === 'playlist') {
					playlistId = this.getNodeParameter('playlist_id', itemIndex, '') as string;

					const playlist = await youtube.getPlaylist(playlistId);
					const videos: PlaylistVideos = playlist!.videos! as PlaylistVideos;

					for (const video of [...videos.items, ...(await videos.next(0))]) {
						returnData.push({
							json: {
								id: video.id,
								title: video.title,
								description: video.description,
								thumbnail: video.thumbnails.best,
								channel: {
									id: video.channel?.id,
									name: video.channel?.name,
								},
								viewCount: video.viewCount,
								uploadDate: video.uploadDate,
								duration: video.duration,
							},
							pairedItem: { item: itemIndex },
						});
					}
				} else if (operation === 'search') {
					keywords = this.getNodeParameter('keywords', itemIndex, '') as string;
					pageCount = this.getNodeParameter('pageCount', itemIndex, 1) as number;

					let videos = await youtube.search(keywords, {
						type: 'video',
					});
					for (const video of [...videos.items, ...(await videos.next(pageCount))]) {
						returnData.push({
							json: {
								id: video.id,
								title: video.title,
								description: video.description,
								thumbnail: video.thumbnails.best,
								channel: {
									id: video.channel?.id,
									name: video.channel?.name,
								},
								viewCount: video.viewCount,
								uploadDate: video.uploadDate,
								duration: video.duration,
							},
							pairedItem: { item: itemIndex },
						});
					}
				} else if (operation === 'get_video') {
					videoId = this.getNodeParameter('video_id', itemIndex, '') as string;

					let video = await youtube.getVideo(videoId);
					if (video) {
						returnData.push({
							json: {
								id: video.id,
								title: video.title,
								description: video.description,
								thumbnail: video.thumbnails.best,
								channel: {
									id: video.channel?.id,
									name: video.channel?.name,
								},
								viewCount: video.viewCount,
								likeCount: video.likeCount,
								uploadDate: video.uploadDate,
								tags: video.tags,
							},
							pairedItem: { item: itemIndex },
						});
					}
				} else if (operation === 'get_channel') {
					channelId = this.getNodeParameter('channel_id', itemIndex, '') as string;

					let channel = await youtube.getChannel(channelId);

					if (channel) {
						returnData.push({
							json: {
								id: channel.id,
								name: channel.name,
								thumbnail: channel.thumbnails?.best,
								url: channel.url,
								banner: channel.banner?.best,
								subscriberCount: channel.subscriberCount,
							},
							pairedItem: { item: itemIndex },
						});
					}
				} else if (operation === 'get_playlist') {
					playlistId = this.getNodeParameter('playlist_id', itemIndex, '') as string;

					let playlist = await youtube.getPlaylist(playlistId);

					if (playlist) {
						returnData.push({
							json: {
								id: playlist.id,
								title: playlist.title,
							},
							pairedItem: { item: itemIndex },
						});
					}
				}
			} catch (error) {
				const operation = this.getNodeParameter('operation', itemIndex, '') as string;
				const params: Record<string, any> = {
					operation,
				};
				switch (operation) {
					case 'channel':
					case 'get_channel':
						params.channel_id = this.getNodeParameter('channel_id', itemIndex, '') as string;
						break;
					case 'playlist':
					case 'get_playlist':
						params.playlist_id = this.getNodeParameter('playlist_id', itemIndex, '') as string;
						break;
					case 'search':
						params.keywords = this.getNodeParameter('keywords', itemIndex, '') as string;
						params.pageCount = this.getNodeParameter('pageCount', itemIndex, 1) as number;
						break;
					case 'get_video':
						params.video_id = this.getNodeParameter('video_id', itemIndex, '') as string;
						break;
				}
				const detailedErrorMessage = generateDetailedError(error, operation, params);

				if (this.continueOnFail()) {
					returnData.push({ json: { error: detailedErrorMessage }, error, pairedItem: itemIndex });
				} else {
					throw new NodeOperationError(this.getNode(), detailedErrorMessage, { itemIndex });
				}
			}
		}

		return [returnData];
	}
}
