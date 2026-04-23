declare module "*.css" {}

declare module "superstore-arrow" {
  const url: string;
  export default url;
}

declare module "superstore-arrow/*.arrow" {
  const url: string;
  export default url;
}

declare module "superstore-arrow/*.parquet" {
  const url: string;
  export default url;
}

declare module "superstore-arrow/*.csv" {
  const url: string;
  export default url;
}
