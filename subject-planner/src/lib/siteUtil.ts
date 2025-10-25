export const nodeDisplayNameMap: Record<NodeTypes, string> = {
    ['Program']: 'programName',
    ['Subject']: 'code',
    ['Major']: 'majorName',
    ['Minor']: 'minorName',
    ['Prerequisites']: 'course',
    ['SubjectChoice']: 'choices'
}

export const nodeFillMap: Record<NodeTypes, string> = {
    ['Program']: '#0C3C51',
    ['Subject']: '#ff95b6',
    ['Major']: '#195db0',
    ['Minor']: '#969bf9',
    ['Prerequisites']: '#F79767',
    ['SubjectChoice']: '#ffdc80'
}

export const nodeSizeMap: Record<NodeTypes, number> = {
    ['Program']: 50,
    ['Subject']: 20,
    ['Major']: 40,
    ['Minor']: 30,
    ['Prerequisites']: 10,
    ['SubjectChoice']: 10
}

export type NodeTypes = 'Program' | 'Subject' | 'Major' | 'Minor' | 'Prerequisites' | 'SubjectChoice';

export interface RGBAType {
    red: number
    green: number
    blue: number
    alpha?: number
}


// yoinked from an old project
export class RGBA {
    readonly rgba: RGBAType = {red: 0, green: 0, blue: 0, alpha: 0};
    constructor (red: number, green: number, blue: number, alpha?: number){
        this.rgba = {red: red, green: green, blue: blue, alpha: alpha} as RGBAType;
        return this;
    }

    // A hacky way to skip having to put in each individual value, you must bind the parent value, or it will error.
    // If your intellisense is good, it'll save you a bit of time, and guarantees you don't mess up the order.
    // EXAMPLE: fgCircleColour.passToA(cr.setSourceRGBA.bind(cr));
    public passTo(func: (r: number, g: number, b: number)=>any) {
        return func(this.rgba.red, this.rgba.green, this.rgba.blue);
    }
    public passToA(func: (r: number, g: number, b: number, a: number)=>any) {
        if (!this.rgba.alpha) throw "Missing Alpha Value";
        return func(this.rgba.red, this.rgba.green, this.rgba.blue,this.rgba.alpha);
    }
    public invert(){
        if (this.rgba.alpha){
            return new RGBA(1-this.rgba.red,1-this.rgba.green,1-this.rgba.blue,this.rgba.alpha);
        } else {
            return new RGBA(1-this.rgba.red,1-this.rgba.green,1-this.rgba.blue);
        }
    }
    public multiply(value: number) {
        if (this.rgba.alpha){
            return new RGBA(
                this.clamp(this.rgba.red*value),
                this.clamp(this.rgba.green*value),
                this.clamp(this.rgba.blue*value),
                this.rgba.alpha
            );
        } else {
            return new RGBA(
                this.clamp(this.rgba.red*value),
                this.clamp(this.rgba.green*value),
                this.clamp(this.rgba.blue*value)
            );
        }
    }
    public add(value: number) {
        if (this.rgba.alpha){
            return new RGBA(
                this.clamp(this.rgba.red+value),
                this.clamp(this.rgba.green+value),
                this.clamp(this.rgba.blue+value),
                this.rgba.alpha
            );
        } else {
            return new RGBA(
                this.clamp(this.rgba.red+value),
                this.clamp(this.rgba.green+value),
                this.clamp(this.rgba.blue+value)
            );
        }
    }

    public toHexAlpha(){
        return '#'+this.expand(Math.round(this.rgba.red*255).toString(16)) +
            this.expand(Math.round(this.rgba.green*255).toString(16)) +
            this.expand(Math.round(this.rgba.blue*255).toString(16)) +
            this.expand((this.rgba.alpha ? Math.round(this.rgba.alpha*255).toString(16) : ''));
    }

    public toHex() {
        return '#'+this.expand(Math.round(this.rgba.red*255).toString(16)) +
            this.expand(Math.round(this.rgba.green*255).toString(16)) +
            this.expand(Math.round(this.rgba.blue*255).toString(16));
    }


    private expand(s: string){
        if (s.length == 1){
            return '0'+s;
        } else return s;
    }
    private clamp(value: number){
        return Math.max(Math.min(value,1),0);
    }
}

export class HEXGBA extends RGBA {
    constructor (hexstring: string) {
        if(hexstring[0]!=='#') throw "Incorrect format for hex string";
        let values = [0,0,0,1]
        for (let i = 1; i < hexstring.length && i < 9; i+=2) {
            values[(i-1)/2] = Number('0x'+hexstring.slice(i,i+2))/255; // I giggled writing this lmao
        }
        switch (hexstring.length) {
            case 7:
                super(values[0],values[1],values[2]);
                break;
            case 9:
                super(values[0],values[1],values[2],values[3]);
                break;
            default:
                throw "Unexpected length of hex colour string";
        }
        return this;
    }
}
