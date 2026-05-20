-- Script untuk membuat tabel tracked_tickers di Supabase
-- Jalankan manual di Supabase SQL Editor atau gunakan migration tool

CREATE TABLE IF NOT EXISTS tracked_tickers (
    id BIGSERIAL PRIMARY KEY,
    ticker VARCHAR(10) UNIQUE NOT NULL,
    added_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tambah index untuk performa query
CREATE INDEX IF NOT EXISTS idx_tracked_tickers_ticker ON tracked_tickers(ticker);

-- Insert initial tickers (jalankan sekali)
INSERT INTO tracked_tickers (ticker) VALUES
('ACES'), ('ACST'), ('ADES'), ('ADHI'), ('ADMG'), ('AGAR'), ('AGII'), ('AGRO'), ('AGRS'), ('AHAP'),
('AIMS'), ('AISA'), ('AKKU'), ('AKPI'), ('AKSI'), ('ALDO'), ('ALKA'), ('ALMI'), ('AMAG'), ('AMFG'),
('AMIN'), ('AMOR'), ('ANDI'), ('ANJT'), ('ANTM'), ('APEX'), ('ARCI'), ('ARGO'), ('ARII'), ('ARMY'),
('ARNA'), ('ARTI'), ('ASBI'), ('ASDM'), ('ASGR'), ('ASJT'), ('ASMI'), ('ASRI'), ('ASRM'), ('ASUR'),
('ATIC'), ('AUTO'), ('BABP'), ('BACA'), ('BALI'), ('BAPA'), ('BATA'), ('BAYU'), ('BBCA'), ('BBNI'),
('BBRI'), ('BBRM'), ('BBSS'), ('BBTN'), ('BBYB'), ('BCAP'), ('BCIC'), ('BDMN'), ('BEKS'), ('BEST'),
('BFIN'), ('BGTG'), ('BIMA'), ('BINA'), ('BIPI'), ('BJBR'), ('BJTM'), ('BKDP'), ('BKSL'), ('BLTA'),
('BMAS'), ('BMRI'), ('BMTR'), ('BNBA'), ('BNGA'), ('BNII'), ('BNLI'), ('BOLT'), ('BOSS'), ('BRAM'),
('BRIS'), ('BRMS'), ('BRNA'), ('BRPT'), ('BSDE'), ('BSWD'), ('BTEL'), ('BTEK'), ('BTPS'), ('BUDI'),
('BUKA'), ('BULL'), ('BUMI'), ('BVIC'), ('BWPT'), ('BYAN'), ('CARS'), ('CASA'), ('CBMF'), ('CCAP'),
('CEKA'), ('CENT'), ('CFIN'), ('CITA'), ('CITY'), ('CLEO'), ('CLPI'), ('CMNP'), ('CMPP'), ('CNKO'),
('CNMA'), ('CPIN'), ('CPRO'), ('CSAP'), ('CTRA'), ('CTTH'), ('DART'), ('DAYA'), ('DEAL'), ('DEFI'),
('DEPO'), ('DGIK'), ('DGNS'), ('DILD'), ('DKFT'), ('DLTA'), ('DMAS'), ('DMND'), ('DOID'), ('DPNS'),
('DSFI'), ('DSNG'), ('DUTI'), ('DVLA'), ('DWGL'), ('DYAN'), ('ECII'), ('EDGE'), ('EKAD'), ('ELTY'),
('EMTK'), ('ENAK'), ('ENRG'), ('EPMT'), ('ERAA'), ('ERTX'), ('ESSA'), ('ESTI'), ('ETWA'), ('EXCL'),
('FAPA'), ('FAST'), ('FILM'), ('FIRE'), ('FISH'), ('FMII'), ('FORU'), ('FPNI'), ('FREN'), ('GAMA'),
('GDST'), ('GEMA'), ('GGRM'), ('GIAA'), ('GJTL'), ('GLVA'), ('GMFI'), ('GOLD'), ('GOTO'), ('GPRA'),
('GTRA'), ('GWSA'), ('HADE'), ('HAKI'), ('HATM'), ('HDFA'), ('HEAL'), ('HELI'), ('HERO'), ('HEXA'),
('HITS'), ('HMSP'), ('HOME'), ('HRTA'), ('HRUM')
ON CONFLICT DO NOTHING;
